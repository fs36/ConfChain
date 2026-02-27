import {
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Role } from "@prisma/client";
import { Response } from "express";
import { Request } from "express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { Public } from "../common/public.decorator";
import { Roles } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { CreatePaperDto } from "./dto/create-paper.dto";
import { PapersService } from "./papers.service";

type AuthUserRequest = Request & { user: { id: string; role: Role; sub: string } };

const multerStorage = diskStorage({
  destination: join(process.cwd(), "uploads"),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `paper-${unique}${extname(file.originalname)}`);
  },
});

@Controller("papers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  /**
   * 投稿接口（支持文件上传）
   * Content-Type: multipart/form-data
   * 字段：title, abstract, keywords（逗号分隔字符串）, file（PDF/Word，可选）
   */
  @Post()
  @Roles(Role.AUTHOR)
  @UseInterceptors(FileInterceptor("file", { storage: multerStorage }))
  async create(
    @Req() req: AuthUserRequest,
    @Body() body: { title: string; abstract: string; keywords: string },
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 })],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    const dto: CreatePaperDto = {
      title: body.title,
      abstract: body.abstract,
      keywords: body.keywords
        ? body.keywords.split(",").map((k) => k.trim()).filter(Boolean)
        : [],
    };
    return this.papersService.uploadAndCertify(req.user.sub ?? req.user.id, dto, file);
  }

  /** 对已有稿件重新存证（传入文件内容文本） */
  @Post(":id/certify")
  @Roles(Role.AUTHOR)
  certify(
    @Req() req: AuthUserRequest,
    @Param("id") id: string,
    @Body("fileContent") fileContent: string,
  ) {
    return this.papersService.certify(id, req.user.sub ?? req.user.id, fileContent);
  }

  /** 我的稿件列表 */
  @Get("mine")
  @Roles(Role.AUTHOR)
  mine(@Req() req: AuthUserRequest) {
    return this.papersService.listMine(req.user.sub ?? req.user.id);
  }

  /** 管理员：所有稿件 */
  @Get("admin/all")
  @Roles(Role.ADMIN)
  listAll() {
    return this.papersService.listAll();
  }

  /** 公开：通过哈希验证版权（无需鉴权） */
  @Public()
  @Get("verify")
  verify(@Query("fileHash") fileHash: string) {
    return this.papersService.verifyByHash(fileHash);
  }

  /** 公开：上传文件验证版权（无需鉴权） */
  @Public()
  @Post("verify/file")
  @UseInterceptors(FileInterceptor("file", { storage: multerStorage }))
  async verifyByFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Res() res: Response,
  ) {
    const { readFile } = await import("fs/promises");
    const buffer = await readFile(file.path);
    const result = await this.papersService.verifyByFile(buffer);
    // 验证完成后删除临时文件
    try {
      const { unlink } = await import("fs/promises");
      await unlink(file.path);
    } catch {}
    return res.json(result);
  }

  /** 查询稿件裁定结果（作者本人或管理员） */
  @Get(":id/adjudication")
  @Roles(Role.AUTHOR, Role.ADMIN)
  adjudication(@Req() req: AuthUserRequest, @Param("id") id: string) {
    const isAdmin = req.user.role === Role.ADMIN;
    return this.papersService.getAdjudication(id, req.user.sub ?? req.user.id, isAdmin);
  }

  /** 审稿人下载已分配稿件的文件（仅当有审稿任务时可访问） */
  @Get(":id/download-as-reviewer")
  @Roles(Role.REVIEWER)
  async downloadAsReviewer(
    @Req() req: AuthUserRequest,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const { absPath, fileName } = await this.papersService.getFilePathForReviewer(
      id,
      req.user.sub ?? req.user.id,
    );
    res.download(absPath, fileName);
  }

  /** 作者提交修订稿（仅 REVISION 状态）：上传新文件并重新存证 */
  @Post(":id/revise")
  @Roles(Role.AUTHOR)
  @UseInterceptors(FileInterceptor("file", { storage: multerStorage }))
  async revise(
    @Req() req: AuthUserRequest,
    @Param("id") id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.papersService.submitRevision(id, req.user.sub ?? req.user.id, file);
  }

  /** 下载稿件文件（AUTHOR 本人 或 ADMIN） */
  @Get(":id/download")
  @Roles(Role.AUTHOR, Role.ADMIN)
  async download(
    @Req() req: AuthUserRequest,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const isAdmin = req.user.role === Role.ADMIN;
    const { absPath, fileName } = await this.papersService.getFilePath(
      id,
      req.user.sub ?? req.user.id,
      isAdmin,
    );
    res.download(absPath, fileName);
  }
}
