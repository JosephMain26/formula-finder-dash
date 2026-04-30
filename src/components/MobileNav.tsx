import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Home, Settings, Building2, Wrench, LogOut, BarChart3, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface MobileNavProps {
  className?: string;
}

export function MobileNav({ className }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { user, role, isAdmin, signOut, can } = useAuth();

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[260px] p-0">
        <SheetHeader className="p-4 border-b text-left">
          <SheetTitle className="text-base">Menu</SheetTitle>
          {user && (
            <div className="text-xs text-muted-foreground truncate">
              {user.email}
              {role && <span className="ml-1 uppercase">· {role}</span>}
            </div>
          )}
        </SheetHeader>
        <nav className="p-2 flex flex-col gap-1">
          <Link to="/" onClick={close} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm">
            <Home className="h-4 w-4" /> Dashboard
          </Link>
          {can("databoard.view") && (
            <Link to="/databoard" onClick={close} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm">
              <BarChart3 className="h-4 w-4" /> DataBoard
            </Link>
          )}
          {isAdmin && (
            <>
              <Link to="/settings" onClick={close} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm">
                <Settings className="h-4 w-4" /> Settings
              </Link>
              <Link to="/companies" onClick={close} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm">
                <Building2 className="h-4 w-4" /> Marketers
              </Link>
              <Link to="/technicians" onClick={close} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm">
                <Wrench className="h-4 w-4" /> Technicians
              </Link>
              <Link to="/installers" onClick={close} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm">
                <Wrench className="h-4 w-4" /> Installers
              </Link>
              <Link to="/clients" onClick={close} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm">
                <Users className="h-4 w-4" /> Clients
              </Link>
            </>
          )}
          <button
            onClick={() => { close(); signOut(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm text-left mt-2 border-t pt-3"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
