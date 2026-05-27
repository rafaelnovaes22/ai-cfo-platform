import DashboardCard from "@/components/DashboardCard.tsx";
import { useAnalyses } from "../data/useAnalyses.ts";
import LoanPreApprovedCard from "@/components/LoanPreApprovedCard.tsx";
import DebitsCard from "@/components/DebitsCard.tsx";
import LoanTable from "@/components/LoanTable.tsx";

export default function Credit() {
  const { activeAnalysis } = useAnalyses();

  return (
    <div className="space-y-8 relative">
      <header className="animate-fade-up flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="uppercase text-[11px] tracking-widest !opacity-30 mb-3">
            {activeAnalysis ? `${activeAnalysis.name}` : ""}
          </div>
          <h1 className="text-2xl leading-[1.05] tracking-tight ">
            Crédito{" "}
            <span className="ml-4 tracking-wider rounded-full align-middle text-center px-2 py-0.5 text-[9px] font-semibold bg-[#75cf5a] dark:bg-[#0f2707] border border-[#74b64d] dark:border-[#235015] dark:text-[#74b64d]">
              EM BREVE
            </span>
          </h1>
        </div>
      </header>
      <div className="flex flex-wrap -mx-4 md:mx-0 gap-4">
        <DashboardCard className="md:min-w-[490px] grow-[2]">
          <LoanPreApprovedCard />
        </DashboardCard>
        <DashboardCard className="md:min-w-[490px] grow-[2]">
          <DebitsCard />
        </DashboardCard>
        <DashboardCard className="min-w-full">
          <LoanTable />
        </DashboardCard>
      </div>
    </div>
  );
}
