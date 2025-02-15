import {
  Decoration,
  EditorState,
  EditorView,
  syntaxTree,
  WidgetType,
} from "../deps.ts";
import {
  decoratorStateField,
  invisibleDecoration,
  isCursorInRange,
} from "./util.ts";

import { renderMarkdownToHtml } from "../../plugs/markdown/markdown_render.ts";
import { ParseTree } from "$sb/lib/tree.ts";
import { lezerToParseTree } from "../../common/markdown_parser/parse_tree.ts";
import type { Editor } from "../editor.tsx";
import { urlToPathname } from "../../plugos/util.ts";

class TableViewWidget extends WidgetType {
  constructor(
    readonly pos: number,
    readonly editor: Editor,
    readonly t: ParseTree,
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const dom = document.createElement("span");
    dom.classList.add("sb-table-widget");
    dom.addEventListener("click", (e) => {
      // Pulling data-pos to put the cursor in the right place, falling back
      // to the start of the table.
      const dataAttributes = (e.target as any).dataset;
      this.editor.editorView!.dispatch({
        selection: {
          anchor: dataAttributes.pos ? +dataAttributes.pos : this.pos,
        },
      });
    });

    renderMarkdownToHtml(this.t, {
      // Annotate every element with its position so we can use it to put
      // the cursor there when the user clicks on the table.
      annotationPositions: true,
      inlineAttachments: async (url): Promise<string> => {
        if (!url.includes("://")) {
          try {
            const d = await this.editor.space.readAttachment(url, "dataurl");
            return d.data as string;
          } catch (e: any) {
            console.error(e);
            return url;
          }
        }
        return url;
      },
    }).then((html) => {
      dom.innerHTML = html;
    });
    return dom;
  }
}

export function tablePlugin(editor: Editor) {
  return decoratorStateField((state: EditorState) => {
    const widgets: any[] = [];
    syntaxTree(state).iterate({
      enter: (node) => {
        const { from, to, name } = node;
        if (name !== "Table") return;
        if (isCursorInRange(state, [from, to])) return;

        const tableText = state.sliceDoc(from, to);
        const lineStrings = tableText.split("\n");

        const lines: { from: number; to: number }[] = [];
        let fromIt = from;
        for (const line of lineStrings) {
          lines.push({
            from: fromIt,
            to: fromIt + line.length,
          });
          fromIt += line.length + 1;
        }

        const firstLine = lines[0], lastLine = lines[lines.length - 1];

        // In case of doubt, back out
        if (!firstLine || !lastLine) return;

        widgets.push(invisibleDecoration.range(firstLine.from, firstLine.to));
        widgets.push(invisibleDecoration.range(lastLine.from, lastLine.to));

        lines.slice(1, lines.length - 1).forEach((line) => {
          widgets.push(
            Decoration.line({ class: "sb-line-table-outside" }).range(
              line.from,
            ),
          );
        });
        const text = state.sliceDoc(0, to);
        widgets.push(
          Decoration.widget({
            widget: new TableViewWidget(
              from,
              editor,
              lezerToParseTree(text, node.node),
            ),
          }).range(from),
        );
      },
    });
    return Decoration.set(widgets, true);
  });
}
