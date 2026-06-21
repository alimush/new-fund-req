import ChequeBranchesPage from "@/components/cheques/ChequeBranchesPage";
import { MUSTASHAR_TEMPLATE_KEY } from "@/lib/cheques/chequeBranches";

export default function MustasharBranchesPage() {
  return (
    <ChequeBranchesPage
      templateKey={MUSTASHAR_TEMPLATE_KEY}
      pageTitle="مصرف المستشار — اختر الفرع"
    />
  );
}
