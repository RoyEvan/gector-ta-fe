"use client"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { Button } from "./ui/button"
import { signIn, signOut, useSession } from "next-auth/react"
import { useEffect } from "react"

export function NavBar() {
  const { data: session, status } = useSession();

  useEffect(() => {
    console.log("Session data:", session);
  }, [session]);

  const handleLogin = async () => {
    try {
      const result = await signIn("google");
      if (!result?.ok) {
        throw new Error("Login failed");
      }
    }
    catch (error) {
      console.error(error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false });
    }
    catch (error) {
      console.error("Sign out failed")
    }
  };

  const navMenuItem = status === "authenticated" ? (
    <>
      <NavigationMenuLink asChild className={navigationMenuTriggerStyle()} >
        <Button variant="outline" onClick={handleSignOut}>{session?.user?.user_id}</Button>
      </NavigationMenuLink>
    </>
  ) : (
    <>
      <NavigationMenuLink asChild className={navigationMenuTriggerStyle()} >
        <Button variant="outline" onClick={handleLogin}>Login with Google</Button>
      </NavigationMenuLink>
    </>
  )

  return (
    <div className="flex w-full justify-end p-2 absolute">
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem className="flex gap-2">{navMenuItem}</NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  )
}
