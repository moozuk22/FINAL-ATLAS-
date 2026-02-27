import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { RestaurantProvider } from "./context/RestaurantContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Index from "./pages/Index";
import CustomerMenu from "./pages/CustomerMenu";
import ClientTables from "./pages/ClientTables";
import TableOptions from "./pages/TableOptions";
import KidsZoneDashboard from "./pages/KidsZoneDashboard";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// OPTIMIZATION: Lazy load admin pages for code splitting
// These pages are only needed by staff, not customers
const StaffDashboard = lazy(() => import("./pages/StaffDashboard"));
const MenuEditor = lazy(() => import("./pages/MenuEditor"));

// Loading component for lazy-loaded routes
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <RestaurantProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
          <Routes>
              <Route path="/" element={<ClientTables />} />
            <Route path="/menu" element={<CustomerMenu />} />
              <Route path="/t/:tableNumber" element={<TableOptions />} />
              <Route path="/table-options/:tableNumber" element={<TableOptions />} />
              <Route 
                path="/admin" 
                element={
                  <Suspense fallback={<PageLoader />}>
                    <StaffDashboard />
                  </Suspense>
                } 
              />
              <Route 
                path="/admin/menu" 
                element={
                  <Suspense fallback={<PageLoader />}>
                    <MenuEditor />
                  </Suspense>
                } 
              />
              <Route 
                path="/admin/kids-zone" 
                element={
                  <Suspense fallback={<PageLoader />}>
                    <KidsZoneDashboard />
                  </Suspense>
                } 
              />
              <Route path="/index" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </RestaurantProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
