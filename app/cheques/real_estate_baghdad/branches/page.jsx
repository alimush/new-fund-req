import ChequeBranchesPage from "@/components/cheques/ChequeBranchesPage";
import { REAL_ESTATE_TEMPLATE_KEY } from "@/lib/cheques/chequeBranches";

export default function RealEstateBranchesPage() {
  return (
    <ChequeBranchesPage
      templateKey={REAL_ESTATE_TEMPLATE_KEY}
      pageTitle="المصرف العقاري — اختر الفرع"
    />
  );
}
