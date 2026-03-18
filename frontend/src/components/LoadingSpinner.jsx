import React from 'react';
import { ClipLoader } from 'react-spinners';

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fff9f6]">
      <div className="text-center">
        <ClipLoader color="#ff4d2d" size={50} />
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;