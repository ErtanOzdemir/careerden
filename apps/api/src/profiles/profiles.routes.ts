import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import multer from "multer";
import type { CreateProfileUseCase, UpdateProfileUseCase } from "@link2cv/application";
import {
  createProfileSchema,
  updateDocumentTemplateMappingsSchema,
  updateDocumentTemplateVariableAliasesSchema,
  updateProfileSchema,
} from "@link2cv/contracts";
import type { DocxTemplateRenderer, FileStorage, UserProfileRepository } from "@link2cv/domain";
import { validateBody } from "../middleware/validate-body.js";

const docxContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function createProfileRouter(dependencies: {
  createProfile: CreateProfileUseCase;
  updateProfile: UpdateProfileUseCase;
  profiles: UserProfileRepository;
  storage: FileStorage;
  docxTemplates: DocxTemplateRenderer;
}): ExpressRouter {
  const router = Router();

  router.post("/", validateBody(createProfileSchema), async (request, response, next) => {
    try {
      const profile = await dependencies.createProfile.execute(request.body);
      response.status(201).json(profile);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      const profile = await dependencies.profiles.findById(request.params.id);

      if (!profile) {
        response.status(404).json({ error: "Profile not found" });
        return;
      }

      response.json(profile);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", validateBody(updateProfileSchema), async (request, response, next) => {
    try {
      const profile = await dependencies.updateProfile.execute(request.params.id, request.body);

      if (!profile) {
        response.status(404).json({ error: "Profile not found" });
        return;
      }

      response.json(profile);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/document-templates", async (request, response, next) => {
    try {
      const profile = await dependencies.profiles.findById(request.params.id);

      if (!profile) {
        response.status(404).json({ error: "Profile not found" });
        return;
      }

      response.json(await dependencies.profiles.listDocumentTemplates(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/document-templates", upload.single("file"), async (request, response, next) => {
    try {
      const profile = await dependencies.profiles.findById(request.params.id);

      if (!profile) {
        response.status(404).json({ error: "Profile not found" });
        return;
      }

      if (!request.file) {
        response.status(400).json({ error: "DOCX file is required" });
        return;
      }

      if (!isDocxUpload(request.file)) {
        response.status(400).json({ error: "Only .docx templates are supported" });
        return;
      }

      const placeholders = await dependencies.docxTemplates.extractPlaceholders(
        request.file.buffer,
      );

      if (placeholders.length === 0) {
        response.status(400).json({
          error: "DOCX template must include at least one {{placeholder_name}} field",
        });
        return;
      }

      const stored = await dependencies.storage.put({
        fileName: request.file.originalname,
        contentType: docxContentType,
        body: request.file.buffer,
        metadata: {
          kind: "cv_template",
          profileId: request.params.id,
        },
      });
      const existing = await dependencies.profiles.listDocumentTemplates(request.params.id);
      const template = await dependencies.profiles.createDocumentTemplate({
        profileId: request.params.id,
        kind: "cv",
        format: "docx",
        fileId: stored.id,
        fileName: request.file.originalname,
        contentType: docxContentType,
        size: request.file.size,
        placeholders,
        isDefault: existing.length === 0,
      });

      response.status(201).json(template);
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:id/document-templates/:templateId/mappings",
    validateBody(updateDocumentTemplateMappingsSchema),
    async (request, response, next) => {
      try {
        const template = await dependencies.profiles.findDocumentTemplateById(
          request.params.templateId,
        );

        if (!template || template.profileId !== request.params.id) {
          response.status(404).json({ error: "Document template not found" });
          return;
        }

        const fieldMappings = request.body.fieldMappings;
        const missing = template.placeholders.filter((placeholder) => !fieldMappings[placeholder]);
        const unknown = Object.keys(fieldMappings).filter(
          (placeholder) => !template.placeholders.includes(placeholder),
        );

        if (missing.length > 0 || unknown.length > 0) {
          response.status(400).json({
            error: "Template mappings must cover every detected placeholder and no unknown fields",
            missing,
            unknown,
          });
          return;
        }

        const updated = await dependencies.profiles.updateDocumentTemplateMappings(
          template.id,
          fieldMappings,
        );

        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:id/document-templates/:templateId/variable-aliases",
    validateBody(updateDocumentTemplateVariableAliasesSchema),
    async (request, response, next) => {
      try {
        const template = await dependencies.profiles.findDocumentTemplateById(
          request.params.templateId,
        );

        if (!template || template.profileId !== request.params.id) {
          response.status(404).json({ error: "Document template not found" });
          return;
        }

        const updated = await dependencies.profiles.updateDocumentTemplateVariableAliases(
          template.id,
          request.body.variableAliases,
        );

        response.json(updated);
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch("/:id/document-templates/:templateId/default", async (request, response, next) => {
    try {
      const template = await dependencies.profiles.setDefaultDocumentTemplate(
        request.params.id,
        request.params.templateId,
      );

      if (!template) {
        response.status(404).json({ error: "Document template not found" });
        return;
      }

      response.json(template);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function isDocxUpload(file: Express.Multer.File): boolean {
  return file.originalname.toLowerCase().endsWith(".docx") || file.mimetype === docxContentType;
}
