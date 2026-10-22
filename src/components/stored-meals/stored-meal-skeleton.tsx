import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { Skeleton } from "@/components/ui/skeleton";

export function StoredMealSkeleton() {
  return (
    <>
      <ScreenBody className="flex flex-col gap-5">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </ScreenBody>
      <ScreenFooter>
        <Skeleton className="h-10 w-full" />
      </ScreenFooter>
    </>
  );
}
