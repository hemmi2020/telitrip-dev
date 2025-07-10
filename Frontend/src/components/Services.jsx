import React from 'react';

const servicesData = [
  {
    title: "Customized Tour Packages",
    description:
      "Tailored tour packages based on your preferences, ensuring a personalized travel experience.",
    icon: "../images/pngegg (1).png",
  },
  {
    title: "Local Tour Guides",
    description:
      "Expert local guides to provide you with insider knowledge and enrich your travel experience.",
    icon: "/images/pngegg (2).png",
  },
  {
    title: "Transportation Services",
    description:
      "Convenient transportation options including private cars, buses, and trains for seamless travel.",
    icon: "/images/pngegg (3).png",
  },
  {
    title: "Accommodation Booking",
    description:
      "Wide range of accommodation options from luxury hotels to cozy homestays, catering to all preferences and budgets.",
    icon: "/images/pngegg (4).png",
  },
];

const Services = () => {
  return (
    <section className="py-12 px-6 md:px-16 bg-blue-100">
      <h2 className="text-3xl md:text-4xl font-bold text-center text-black mb-10">
        Our Services
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {servicesData.map((service, index) => (
          <div
            key={index}
            className="bg-blue-200 rounded-lg p-6 text-center shadow hover:shadow-lg transition-shadow duration-300"
          >
            <div className="w-20 h-20 mx-auto mb-4">
              <img
                src={service.icon}
                alt={service.title}
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="text-lg font-semibold text-black mt-2">
              {service.title}
            </h3>
            <p className="text-sm text-black mt-2">{service.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Services;
