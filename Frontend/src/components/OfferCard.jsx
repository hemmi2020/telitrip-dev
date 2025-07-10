import React from 'react'

const OfferCard = ({ title, discount, image, description }) => {
  return (
    <div className="bg-white rounded-lg overflow-hidden shadow-lg flex flex-col md:flex-row">
      <img src={image} alt={title} className="w-full md:w-1/2 h-48 md:h-auto object-cover" />
      <div className="p-6 md:w-1/2">
        <div className="bg-yellow-500 text-white font-bold py-1 px-3 rounded-full inline-block mb-2">
          {discount}
        </div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{description}</p>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-300">
          View Offer
        </button>
      </div>
    </div>
  )
}

export default OfferCard