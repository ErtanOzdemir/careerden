import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { Editor } from "@tiptap/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RichDocument } from "../api/types";
import RichTextEditor, { useRichTextToolbarState } from "./RichTextEditor";
import { toTiptapJson } from "./richDocumentAdapter";
import { createRichTextExtensions } from "./richTextExtensions";

afterEach(cleanup);

const originalRangeGetClientRects = Range.prototype.getClientRects;
const originalRangeGetBoundingClientRect = Range.prototype.getBoundingClientRect;

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

afterAll(() => {
  Range.prototype.getClientRects = originalRangeGetClientRects;
  Range.prototype.getBoundingClientRect = originalRangeGetBoundingClientRect;
});

describe("RichTextEditor", () => {
  it("reacts to selection-only toolbar state changes", () => {
    const editor = new Editor({
      element: null,
      extensions: createRichTextExtensions(),
      content: toTiptapJson({
        version: 1,
        blocks: [
          {
            type: "paragraph",
            children: [
              { type: "text", text: "Bold", marks: [{ type: "bold" }] },
              { type: "text", text: " plain" },
            ],
          },
        ],
      }),
    });
    const { result, unmount } = renderHook(() => useRichTextToolbarState(editor));

    act(() => {
      editor.commands.setTextSelection(2);
    });
    expect(result.current.bold).toBe(true);

    act(() => {
      editor.commands.setTextSelection(8);
    });
    expect(result.current.bold).toBe(false);

    unmount();
    editor.destroy();
  });

  it("switches between bullet and numbered lists", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor
        ariaLabel="List editor"
        onChange={onChange}
        value={paragraph("First item")}
      />,
    );

    const bulletButton = screen.getByRole("button", { name: "Bullet list" });
    fireEvent.mouseDown(bulletButton);
    fireEvent.click(bulletButton);

    await waitFor(() => expect(container.querySelector("ul")).toBeInTheDocument());
    expect(bulletButton).toHaveAttribute("aria-pressed", "true");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        blocks: expect.arrayContaining([expect.objectContaining({ type: "bulletList" })]),
      }),
    );

    const numberedButton = screen.getByRole("button", { name: "Numbered list" });
    fireEvent.mouseDown(numberedButton);
    fireEvent.click(numberedButton);

    await waitFor(() => expect(container.querySelector("ol")).toBeInTheDocument());
    expect(numberedButton).toHaveAttribute("aria-pressed", "true");
    expect(bulletButton).toHaveAttribute("aria-pressed", "false");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        blocks: expect.arrayContaining([expect.objectContaining({ type: "orderedList" })]),
      }),
    );
  });

  it("adds a visible linked URL from the toolbar popover", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor ariaLabel="Link editor" onChange={onChange} value={paragraph("")} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    const input = await screen.findByLabelText("Link URL");
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(container.querySelector("a")).toBeInTheDocument());
    expect(container.querySelector("a")).toHaveAttribute("href", "https://example.com");
    expect(container.querySelector("a")).toHaveTextContent("https://example.com");
    expect(onChange).toHaveBeenCalled();
  });

  it("keeps the link popover open for an unsafe URL", async () => {
    const { container } = render(
      <RichTextEditor ariaLabel="Unsafe link editor" onChange={vi.fn()} value={paragraph("")} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    fireEvent.change(await screen.findByLabelText("Link URL"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid link URL.");
    expect(screen.getByLabelText("Link URL")).toBeInTheDocument();
    expect(container.querySelector("a")).not.toBeInTheDocument();
  });

  it("removes the current link from the popover", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor
        ariaLabel="Existing link editor"
        onChange={onChange}
        value={{
          version: 1,
          blocks: [
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  text: "Example",
                  marks: [{ type: "link", href: "https://example.com" }],
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Link" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() => expect(container.querySelector("a")).not.toBeInTheDocument());
    expect(onChange).toHaveBeenCalled();
  });
});

function paragraph(text: string): RichDocument {
  return {
    version: 1,
    blocks: [
      {
        type: "paragraph",
        children: text ? [{ type: "text", text }] : [],
      },
    ],
  };
}
