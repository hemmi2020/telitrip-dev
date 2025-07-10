import React from 'react';
import ImageSlider from './ImageSlider';

const Accommodation = () => {
  return (
    <div className="px-4 py-16 bg-gray-50 text-center">
      <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">Our Accommodations</h1>
      <p className="text-gray-600 max-w-3xl mx-auto mb-12 text-base md:text-lg">
        Discover the finest accommodations tailored to provide you with the ultimate comfort and relaxation during your stay.
        Our rooms are designed with modern amenities and luxurious touches to ensure a memorable experience. Whether you are
        looking for a cozy retreat or a spacious suite, we offer a variety of options to suit your needs and preferences.
      </p>
      <ImageSlider />
    </div>
  );
};

export default Accommodation;
