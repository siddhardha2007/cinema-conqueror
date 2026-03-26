import { useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import MoviesSection from "@/components/MoviesSection";
import EventsSection from "@/components/EventsSection";
import Footer from "@/components/Footer";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen">
      <Header onSearch={setSearchQuery} />
      {!searchQuery && <Hero />}
      <MoviesSection searchQuery={searchQuery} />
      {!searchQuery && <EventsSection />}
      <Footer />
    </div>
  );
};

export default Index;
