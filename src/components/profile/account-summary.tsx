import { SignOutButton } from "@/components/authentication/sign-out-button";
import { getCurrentUser } from "@/lib/auth/session";

export async function AccountSummary() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{user.name}</p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
      <SignOutButton />
    </div>
  );
}
