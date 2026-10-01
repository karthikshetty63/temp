import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Footer from "../components/layout/Footer";
import Navbar from "../components/layout/Navbar";
import Audiences from "../components/landing/Audiences";
import Faq from "../components/landing/Faq";
import Features from "../components/landing/Features";
import GetStarted from "../components/landing/GetStarted";
import Hero from "../components/landing/Hero";
import HowItWorks from "../components/landing/HowItWorks";

const Home = () => {
  const { hash, key } = useLocation();

  // Links like /#faq (from the header, the footer or another page) scroll to that section.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, key]);

  // The home page uses its own type (Geist); dashboards keep the UI font.
  return (
    <div className="font-landing text-zinc-950 antialiased">
      <Navbar />
      <main className="pt-16">
        <Hero />
        <Features />
        <HowItWorks />
        <Audiences />
        <Faq />
        <GetStarted />
      </main>
      <Footer />
    </div>
  );
};

export default Home;
