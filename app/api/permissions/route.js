import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Permission from "@/models/Permission";

export async function POST(req) {
  await dbConnect();
  const body = await req.json();

  const permission = new Permission(body);
  await permission.save();

  return NextResponse.json({ success: true, data: permission });
}

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const company = searchParams.get("company");

  let filter = {};
  if (userId) filter.userId = userId;
  if (company) filter.company = company;

  const permissions = await Permission.find(filter);
  return NextResponse.json({ success: true, data: permissions });
}

export async function PUT(req) {
  await dbConnect();
  const body = await req.json();

  const updated = await Permission.findByIdAndUpdate(body.id, body, { new: true });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  await Permission.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
