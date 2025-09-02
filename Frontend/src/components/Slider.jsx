// Slider.js
import React, { useEffect, useState, useRef } from "react";
import image1 from "../images/1.jpg";
import image2 from "../images/2.jpg";
import image3 from "../images/3.jpg";
import HotelSearchForm from "./HotelSearchForm";

const Slider = () => {
  const items = [
    {
      id: 1,
      url: image1,
      title: "Welcome to Telitrip Holidays",
      description:
        "Discover the Wonders of Sri Lanka with Ayla Holidays. At Ayla Holidays, we specialize in creating unforgettable travel experiences in the breathtaking island of Sri Lanka.",
    },
    {
      id: 2,
      url: image2,
      title: "Discover the Wonders of Sri Lanka",
      description:
        "From pristine beaches and lush tea plantations to ancient temples and vibrant wildlife. we offer tailor-made tours that showcase the best of our beautiful country.",
    },
    {
      id: 3,
      url: image3,
      title: "Get unforgettable travel experiences",
      description:
        "Book Your Adventure Today! Experience the magic of Sri Lanka with Ayla Holidays. We look forward to welcoming you and making your travel dreams come true.",
    },
  ];

  const [active, setActive] = useState(0);
  const timeoutRef = useRef(null);

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  useEffect(() => {
    resetTimeout();
    timeoutRef.current = setTimeout(() => {
      setActive((prevIndex) =>
        prevIndex === items.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000);

    return () => resetTimeout();
  }, [active]);

  return (
    <main className="mt-16 w-full mb-0">
      <section className="relative w-full h-screen bg-black">
        <div className="relative w-full h-full">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`absolute inset-0 flex justify-center items-center transition-opacity duration-1000 ease-in-out ${
                index === active
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Background Image with Overlay */}
              <div
                className="w-full h-full bg-cover bg-center transition-all duration-1000"
                style={{ backgroundImage: `url(${item.url})` }}
              >
                {/* Dark overlay for better text readability */}
                <div className="absolute inset-0 bg-black/40"></div>
              </div>
              
              {/* Text Content - Responsive positioning */}
              <div className="absolute inset-0 flex flex-col justify-center lg:justify-start lg:pt-32 xl:pt-40 px-4 sm:px-6 lg:px-8 z-10">
                <div className="max-w-7xl mx-auto w-full">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 text-white text-center lg:text-left">
                    {/* Title */}
                    <div className="lg:col-span-2 xl:col-span-1">
                      <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-oswald uppercase leading-tight lg:leading-none transition-transform duration-1000 font-bold">
                        {item.title}
                      </h2>
                    </div>
                    
                    {/* Description */}
                    <div className="space-y-3 sm:space-y-4 lg:col-span-2 xl:col-span-1">
                      <p className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed">
                        {item.description.split(". ")[0]}.
                      </p>
                      {item.description.split(". ")[1] && (
                        <p className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed">
                          {item.description.split(". ")[1]}.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Hotel Search Form - Responsive positioning */}
          <div className=" absolute bottom-4 sm:bottom-6 md:bottom-8 lg:bottom-12 xl:bottom-16 left-1/2 transform -translate-x-1/2 w-full max-w-7xl px-2 sm:px-4 lg:px-8 z-30">
            <div className="bg-transparent rounded-2xl">
              <HotelSearchForm />
            </div>
          </div>

          {/* Slide Indicators */}
          <div className="absolute bottom-20 sm:bottom-24 md:bottom-28 lg:bottom-32 xl:bottom-40 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
            {items.map((_, index) => (
              <button
                key={index}
                onClick={() => setActive(index)}
                className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${
                  index === active 
                    ? 'bg-white shadow-lg' 
                    : 'bg-white/50 hover:bg-white/70'
                }`}
              />
            ))}
          </div>

          {/* Navigation Arrows - Hidden on mobile, visible on larger screens */}
          <div className="hidden md:block">
            <button
              onClick={() => setActive(active === 0 ? items.length - 1 : active - 1)}
              className="absolute left-4 lg:left-8 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-2 lg:p-3 rounded-full transition-all duration-300 z-20 group"
            >
              <svg className="w-4 h-4 lg:w-6 lg:h-6 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={() => setActive(active === items.length - 1 ? 0 : active + 1)}
              className="absolute right-4 lg:right-8 top-1/2 transform -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-2 lg:p-3 rounded-full transition-all duration-300 z-20 group"
            >
              <svg className="w-4 h-4 lg:w-6 lg:h-6 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile-only swipe hints */}
        <div className="md:hidden absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/70 text-xs text-center z-20">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-0.5 bg-white/50 rounded"></div>
            <span>Swipe or tap dots to navigate</span>
            <div className="w-8 h-0.5 bg-white/50 rounded"></div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Slider;