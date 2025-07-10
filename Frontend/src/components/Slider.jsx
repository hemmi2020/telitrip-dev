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
              <div
                className="w-full h-full bg-cover bg-center transition-all duration-1000"
                style={{ backgroundImage: `url(${item.url})` }}
              ></div>
              <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 text-left grid grid-cols-1 md:grid-cols-2 gap-10 text-white max-w-6xl w-full px-4 z-10">
                <h2 className="text-4xl md:text-6xl font-oswald uppercase leading-none transition-transform duration-1000">
                  {item.title}
                </h2>
                <div className="space-y-4">
                  <p className="text-base md:text-lg">
                    {item.description.split(". ")[0]}
                  </p>
                  <p className="text-base md:text-lg">
                    {item.description.split(". ")[1]}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Hotel Search Form Floating at Bottom */}
          <div
            style={{ height: "calc(100vh - 8rem)" }}
            className="absolute flex justify-center items-center top-16 w-full z-30"
          >
            <div className="bg-transparent mt-15 p-8 rounded-2xl">
              <HotelSearchForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Slider;
