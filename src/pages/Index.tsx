import Header from "@/components/Header";
import Hero from "@/components/Hero";
import MoviesSection from "@/components/MoviesSection";
import EventsSection from "@/components/EventsSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <MoviesSection />
      <EventsSection />
      <Footer />
    </div>
  );
};

export default Index;
