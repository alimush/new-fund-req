import ChequeBranchesPage from "@/components/cheques/ChequeBranchesPage";
import { RAFIDAIN_TEMPLATE_KEY } from "@/lib/cheques/chequeBranches";

export default function RafidainBranchesPage() {
  return (
    <ChequeBranchesPage
      templateKey={RAFIDAIN_TEMPLATE_KEY}
      pageTitle="مصرف الرافدين — اختر الفرع"
    />
  );
}
