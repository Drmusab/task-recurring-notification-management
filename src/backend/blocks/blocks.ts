import { fetchPost } from "siyuan";
import * as logger from "@backend/logging/logger";

interface BlockInfoResponse {
  data?: {
    content?: string;
    markdown?: string;
    name?: string;
  };
}

interface BlockHtmlResponse {
  data?: {
    html?: string;
  };
}

export async function fetchBlockPreview(blockId: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      fetchPost(
        "/api/block/getBlockInfo",
        { id: blockId },
        (response: BlockInfoResponse) => {
          const content =
            response?.data?.content ??
            response?.data?.markdown ??
            response?.data?.name ??
            null;
          resolve(content ? content.trim() : null);
        }
      );
    } catch (error) {
      logger.warn("Failed to fetch block preview", error);
      resolve(null);
    }
  });
}

export async function fetchBlockEmbed(blockId: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      fetchPost(
        "/api/block/getBlockHTML",
        { id: blockId },
        (response: BlockHtmlResponse) => {
          const html = response?.data?.html ?? null;
          resolve(html ? html.trim() : null);
        }
      );
    } catch (error) {
      logger.warn("Failed to fetch block embed", error);
      resolve(null);
    }
  });
}
