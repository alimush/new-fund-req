import { use } from "react";
import GroupDetailsClient from "./GroupDetailsClient";

export default function GroupDetails({ params }) {
  const { id } = use(params);  // ← هذا يرجّع الـ ID
  return <GroupDetailsClient groupId={id} />;
}