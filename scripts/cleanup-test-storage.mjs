import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.EXT_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://bpupkgstumvgbxhdhlrx.supabase.co";
const SERVICE_ROLE_KEY =
  process.env.EXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const targets = [
  {
    bucket: "tenant-assets",
    paths: [
      "5d25938d-ef0b-4558-8fb7-82fa97b75be9/logo-1779129034076.png",
      "874776b1-2520-4cb3-920d-e353eb48fc2f/logo-1778971747237.jpg",
      "874776b1-2520-4cb3-920d-e353eb48fc2f/logo-1778977733965.jpg",
      "b2ffa137-73a2-40c1-9cda-4cc8d01530b4/logo-1779813107493.jpg",
    ],
  },
];

if (!SERVICE_ROLE_KEY) {
  console.error(
    "Defina EXT_SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY antes de rodar este script.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

for (const target of targets) {
  if (target.paths.length === 0) continue;

  const { data, error } = await supabase.storage.from(target.bucket).remove(target.paths);
  if (error) {
    console.error(`Erro ao limpar bucket ${target.bucket}:`, error.message);
    process.exit(1);
  }

  console.log(
    `Bucket ${target.bucket}: ${data?.length ?? target.paths.length} objeto(s) removido(s).`,
  );
}

console.log("Limpeza de Storage concluida.");
