import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BookingProvider } from "@/contexts/BookingContext";
import Index from "./pages/Index";
import MovieDetail from "./pages/MovieDetail";
import TheaterSelection from "./pages/TheaterSelection";
import SeatSelection from "./pages/SeatSelection";
import Payment from "./pages/Payment";
import BookingConfirmation from "./pages/BookingConfirmation";
import NotFound from "./pages/NotFound";
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react'; // Ensure lucide-react is installed

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BookingProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
            <Route path="/theaters" element={<TheaterSelection />} />
            <Route path="/seats" element={<SeatSelection />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/confirmation" element={<BookingConfirmation />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </BookingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);
const TheaterScene3D = dynamic(() => import('@/components/TheaterScene'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white">
      <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
      <p>Loading 3D Experience...</p>
    </div>
  )
});

export default function Page() {
  return (
    <main className="w-full h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center px-6 bg-black/50">
        <h1 className="text-white font-bold text-xl">Movie Booking App</h1>
      </div>

      {/* 3D Canvas Container */}
      <div className="flex-1 relative">
        {/* We wrap it in Suspense to handle lazy loading safely */}
        <Suspense fallback={<div className="text-white p-10">Initializing...</div>}>
          <TheaterScene3D />
        </Suspense>
        
        {/* Overlay Instructions */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-6 py-3 rounded-full border border-white/20 text-white pointer-events-none">
          <p className="text-sm font-medium">Click seats to select • Drag to rotate</p>
        </div>
      </div>
    </main>
  );
}

export default App;
