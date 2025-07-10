import React from 'react';

const Row01 = () => {
  return (
    <section className="py-16 px-4 md:px-8 lg:px-16 bg-white ">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 items-center gap-12">
        {/* Left Text */}
        <div>
          <h2 className="text-3xl md:text-4xl font-semibold mb-6 text-gray-800">Why Choose Us?</h2>
          <p className="text-gray-700 leading-relaxed text-base md:text-lg space-y-4">
            <span className="block mb-4">
              <strong>Personalized Itineraries:</strong> We understand that every traveler is unique. Our experienced team works closely with you to craft a personalized itinerary that suits your interests, preferences, and budget.
            </span>
            <span className="block mb-4">
              <strong>Expert Local Guides:</strong> Our knowledgeable local guides are passionate about sharing the rich history, culture, and natural beauty of Sri Lanka. They ensure you gain authentic insights and unforgettable memories.
            </span>
            <span className="block mb-4">
              <strong>Comfort and Convenience:</strong> From luxury accommodations to comfortable transportation, we take care of all the details so you can relax and enjoy your journey.
            </span>
            <span className="block">
              <strong>Sustainable Tourism:</strong> We are committed to responsible travel. We support local communities and strive to minimize our environmental footprint, ensuring that Sri Lanka remains a paradise for future generations.
            </span>
          </p>
        </div>

        {/* Right Image */}
        <div className="w-full flex justify-center md:justify-end">
          <img
            src="/images/13379598_5210980.jpg"
            alt="Why Choose Us Illustration"
            className="w-full max-w-md md:max-w-lg lg:max-w-xl object-contain"
          />
        </div>
      </div>
    </section>
  );
};

export default Row01;
