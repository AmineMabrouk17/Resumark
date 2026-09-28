import { AppErrorBoundary } from "@/components/ui/AppErrorBoundary";
import { ResumeWorkbench } from "@/components/layout/ResumeWorkbench";

export default function Page() {
  return (
    <AppErrorBoundary>
      <ResumeWorkbench />
    </AppErrorBoundary>
  );
}
