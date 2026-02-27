import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** 标记该接口为公开，无需 JWT 鉴权 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
