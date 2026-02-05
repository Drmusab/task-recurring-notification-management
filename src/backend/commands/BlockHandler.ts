/**
 * Block Handler - Utilities for extracting and managing SiYuan block content
 */

export interface BlockData {
  blockId: string;
  content: string;
  isChecklist: boolean;
}

/**
 * Get current block content from selection context
 * Uses the same logic as ShortcutManager.getSelectedBlockContext
 */
export function getCurrentBlockContent(): BlockData | null {
  const selection = window.getSelection();
  const anchor = selection?.anchorNode;
  if (!anchor) return null;

  const element = anchor instanceof HTMLElement ? anchor : anchor.parentElement;
  if (!element) return null;

  const blockElement = element.closest("[data-node-id]") as HTMLElement | null;
  if (!blockElement) return null;

  const blockId = blockElement.getAttribute("data-node-id");
  if (!blockId) return null;

  const content = blockElement.textContent || "";
  
  // Check if this is a checklist item
  const isChecklist = /^-\s*\[\s*[x\s\-]\s*\]/i.test(content.trim());

  return {
    blockId,
    content: content.trim(),
    isChecklist
  };
}
