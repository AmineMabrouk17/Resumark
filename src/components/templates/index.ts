"use client";

import type { ComponentType } from "react";

import type { ResumeTemplate } from "@/types/resume";
import { ClassicTemplate } from "@/components/templates/ClassicTemplate";
import { EditorialTemplate } from "@/components/templates/EditorialTemplate";
import { ExecutiveTemplate } from "@/components/templates/ExecutiveTemplate";
import { ModernTemplate } from "@/components/templates/ModernTemplate";
import { MinimalTemplate } from "@/components/templates/MinimalTemplate";
import type { TemplateProps } from "@/components/templates/ResumeDocumentView";

/** Template registry used by the switcher and the preview. */
export const TEMPLATE_COMPONENTS: Record<ResumeTemplate, ComponentType<TemplateProps>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  editorial: EditorialTemplate,
  executive: ExecutiveTemplate,
};
