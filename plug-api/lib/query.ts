import { ParseTree, renderToText, replaceNodesMatching } from "$sb/lib/tree.ts";

export const queryRegex =
  /(<!--\s*#query\s+(.+?)-->)(.+?)(<!--\s*\/query\s*-->)/gs;

export const directiveStartRegex = /<!--\s*#([\w\-]+)\s+(.+?)-->/s;

export const directiveEndRegex = /<!--\s*\/([\w\-]+)\s*-->/s;

export type QueryFilter = {
  op: string;
  prop: string;
  value: any;
};

export type ParsedQuery = {
  table: string;
  orderBy?: string;
  orderDesc?: boolean;
  limit?: number;
  filter: QueryFilter[];
  select?: string[];
  render?: string;
};

export function applyQuery<T>(parsedQuery: ParsedQuery, records: T[]): T[] {
  let resultRecords: any[] = [];
  if (parsedQuery.filter.length === 0) {
    resultRecords = records.slice();
  } else {
    recordLoop:
    for (const record of records) {
      const recordAny: any = record;
      for (const { op, prop, value } of parsedQuery.filter) {
        switch (op) {
          case "=": {
            const recordPropVal = recordAny[prop];
            if (Array.isArray(recordPropVal) && !Array.isArray(value)) {
              // Record property is an array, and value is a scalar: find the value in the array
              if (!recordPropVal.includes(value)) {
                continue recordLoop;
              }
            } else if (Array.isArray(recordPropVal) && Array.isArray(value)) {
              // Record property is an array, and value is an array: find the value in the array
              if (!recordPropVal.some((v) => value.includes(v))) {
                continue recordLoop;
              }
            } else if (!(recordPropVal == value)) {
              // Both are scalars: exact value
              continue recordLoop;
            }
            break;
          }
          case "!=":
            if (!(recordAny[prop] != value)) {
              continue recordLoop;
            }
            break;
          case "<":
            if (!(recordAny[prop] < value)) {
              continue recordLoop;
            }
            break;
          case "<=":
            if (!(recordAny[prop] <= value)) {
              continue recordLoop;
            }
            break;
          case ">":
            if (!(recordAny[prop] > value)) {
              continue recordLoop;
            }
            break;
          case ">=":
            if (!(recordAny[prop] >= value)) {
              continue recordLoop;
            }
            break;
          case "=~":
            // TODO: Cache regexps somehow
            if (!new RegExp(value).exec(recordAny[prop])) {
              continue recordLoop;
            }
            break;
          case "!=~":
            if (new RegExp(value).exec(recordAny[prop])) {
              continue recordLoop;
            }
            break;
          case "in":
            if (!value.includes(recordAny[prop])) {
              continue recordLoop;
            }
            break;
        }
      }
      resultRecords.push(recordAny);
    }
  }
  // Now the sorting
  if (parsedQuery.orderBy) {
    resultRecords = resultRecords.sort((a: any, b: any) => {
      const orderBy = parsedQuery.orderBy!;
      const orderDesc = parsedQuery.orderDesc!;
      if (a[orderBy] === b[orderBy]) {
        return 0;
      }

      if (a[orderBy] < b[orderBy]) {
        return orderDesc ? 1 : -1;
      } else {
        return orderDesc ? -1 : 1;
      }
    });
  }
  if (parsedQuery.limit) {
    resultRecords = resultRecords.slice(0, parsedQuery.limit);
  }
  if (parsedQuery.select) {
    resultRecords = resultRecords.map((rec) => {
      const newRec: any = {};
      for (const k of parsedQuery.select!) {
        newRec[k] = rec[k];
      }
      return newRec;
    });
  }
  return resultRecords;
}

export function removeQueries(pt: ParseTree) {
  replaceNodesMatching(pt, (t) => {
    if (t.type !== "Directive") {
      return;
    }
    const renderedText = renderToText(t);
    return {
      from: t.from,
      to: t.to,
      text: new Array(renderedText.length + 1).join(" "),
    };
  });
}
