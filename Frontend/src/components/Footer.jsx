import React from 'react';
import { BsArrowRight, BsFacebook, BsTwitter, BsInstagram, BsLinkedin } from 'react-icons/bs';

const Footer = () => {
  return (
    <footer className="bg-gradient-to-br from-[#010115] via-[#0a0825] to-[#010115] text-white py-16 px-4 md:px-0 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-32 h-32 bg-[#3f8cff] rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-[#009dff] rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-[#100d44] rounded-full blur-2xl"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Logo and Description */}
          <div className="md:col-span-1 space-y-6">
            <div className="transform hover:scale-105 transition-transform duration-300">
              <img 
                src="/images/Telitrip-Logo-White.png" 
                alt="Telitrip Logo" 
                className="h-12 mb-4 filter drop-shadow-lg"
              />
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold bg-gradient-to-r from-[#3f8cff] to-[#009dff] bg-clip-text text-transparent">
                Book Your Adventure Today!
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Experience the magic of Sri Lanka with Telitrip Holidays. We look forward to welcoming you and making your travel dreams come true.
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-1">
            <h5 className="text-[#3f8cff] text-xl font-semibold mb-6 relative">
              Quick Links
              <div className="absolute -bottom-2 left-0 w-12 h-0.5 bg-gradient-to-r from-[#3f8cff] to-[#009dff] rounded-full"></div>
            </h5>
            <ul className="space-y-3">
              {[
                { text: 'Home', href: '#home' },
                { text: 'Contact Us', href: '#contact' },
                { text: 'Reviews', href: '#reviews' },
                { text: 'FAQs', href: '#faqs' },
                { text: 'About Us', href: '#about' },
                { text: 'Privacy Policy', href: '#privacy' },
                { text: 'Terms & Conditions', href: '#terms' }
              ].map((link, index) => (
                <li key={index} className="group">
                  <a 
                    href={link.href} 
                    className="text-gray-300 hover:text-[#3f8cff] transition-all duration-300 flex items-center group-hover:translate-x-2"
                  >
                    <span className="w-2 h-2 bg-[#3f8cff] rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                    {link.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact and Social */}
          <div className="md:col-span-1">
            <h5 className="text-[#3f8cff] text-xl font-semibold mb-6 relative">
              Stay Connected
              <div className="absolute -bottom-2 left-0 w-12 h-0.5 bg-gradient-to-r from-[#3f8cff] to-[#009dff] rounded-full"></div>
            </h5>
            
            {/* Contact Info */}
            <div className="mb-8 space-y-4">
              <p className="text-gray-300 leading-relaxed">
                Ready to embark on your  adventure? Get in touch with us today and let's plan your perfect getaway!
              </p>
              <div className="bg-gradient-to-r from-[#100d44]/50 to-[#0a0825]/50 backdrop-blur-sm p-4 rounded-lg border border-[#3f8cff]/20">
                <p className="text-[#3f8cff] font-semibold mb-2">Contact Us</p>
                <p className="text-gray-300 text-sm">Get personalized travel recommendations and expert guidance for your Sri Lankan journey.</p>
              </div>
            </div>

            {/* Social Media */}
            <div className="space-y-4">
              <h6 className="text-gray-300 font-medium">Follow Us</h6>
              <div className="flex space-x-4">
                {[
                  { icon: BsFacebook, href: '#facebook', color: 'hover:text-blue-500' },
                  { icon: BsTwitter, href: '#twitter', color: 'hover:text-blue-400' },
                  { icon: BsInstagram, href: '#instagram', color: 'hover:text-pink-500' },
                  { icon: BsLinkedin, href: '#linkedin', color: 'hover:text-blue-600' }
                ].map((social, index) => (
                  <a
                    key={index}
                    href={social.href}
                    className={`text-gray-400 ${social.color} transition-all duration-300 transform hover:scale-110 p-2 rounded-full hover:bg-white/10`}
                  >
                    <social.icon className="text-xl" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-[#3f8cff]/30 to-transparent mb-8"></div>

        {/* Copyright */}
        <div className="bg-gradient-to-r from-[#100d44]/50 to-[#0a0825]/50 backdrop-blur-sm py-6 px-8 rounded-2xl border border-[#3f8cff]/20 text-center">
          <p className="text-gray-300 text-sm">
            &copy; 2025 <span className="text-[#3f8cff] font-semibold">TELITRIP</span> Holidays | All rights reserved | 
            <span className="text-[#009dff]"> Developed By Team Rhino</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;