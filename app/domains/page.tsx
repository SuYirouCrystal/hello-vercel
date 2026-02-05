import { supabase } from "@/lib/supabase";

export default async function DomainsPage() {
  const { data, error } = await supabase
    .from("allowed_signup_domains")
    .select("id, apex_domain");

  if (error) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Error</h1>
        <p>{error.message}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Allowed Signup Domains</h1>

      <ul>
        {data?.map((row) => (
          <li key={row.id}>{row.apex_domain}</li>
        ))}
      </ul>
    </main>
  );
}