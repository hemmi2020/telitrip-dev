import React, { useState } from 'react';

const ImageSlider = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const images = [
    '/images/1.jpg',
    '/images/2.jpg',
    '/images/3.jpg',
    '/images/4.jpg',
    '/images/5.jpg',
    '/images/6.jpg',
    '/images/7.jpg',
    '/images/8.jpg',
    '/images/9.jpg',
    '/images/10.jpg',
  ];

  const itemsPerSlide = 4;
  const maxIndex = images.length - itemsPerSlide;

  const nextSlide = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, maxIndex));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto overflow-hidden py-6">
      <div className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${(100 / itemsPerSlide) * currentIndex}%)` }}
      >
        {images.map((src, index) => (
          <div key={index} className="w-1/4 p-2 flex-shrink-0">
            <img
              src={src}
              alt={`Image ${index + 1}`}
              className="w-full h-48 object-cover rounded-xl shadow-md"
            />
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <button
        onClick={prevSlide}
        disabled={currentIndex === 0}
        className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white shadow p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
      >
        &#8592;
      </button>
      <button
        onClick={nextSlide}
        disabled={currentIndex === maxIndex}
        className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white shadow p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
      >
        &#8594;
      </button>
    </div>
  );
};

export default ImageSlider;
