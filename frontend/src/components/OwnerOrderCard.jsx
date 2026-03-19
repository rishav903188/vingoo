import axios from 'axios';
import React from 'react'
import { MdPhone } from "react-icons/md";
import { serverUrl } from '../App';
import { useDispatch } from 'react-redux';
import { updateOrderStatus, updateOrderAssignedBoy } from '../redux/userSlice';
import { useState } from 'react';
import { useEffect } from 'react';
function OwnerOrderCard({ data }) {
    const [availableBoys,setAvailableBoys]=useState([])
const dispatch=useDispatch()
    const handleUpdateStatus=async (orderId,shopId,status) => {
        try {
            const result=await axios.post(`${serverUrl}/api/order/update-status/${orderId}/${shopId}`,{status},{withCredentials:true})
             dispatch(updateOrderStatus({orderId,shopId,status}))
             setAvailableBoys(result.data.availableBoys)
             console.log(result.data)
        } catch (error) {
            console.log(error)
        }
    }

    const handleAssignBoy = async (orderId, shopId, deliveryBoyId) => {
        try {
             await axios.post(`${serverUrl}/api/order/assign-delivery-boy/${orderId}/${shopId}`,{deliveryBoyId},{withCredentials:true});
             alert('Delivery Boy Assigned Successfully');
             const boy = availableBoys.find(b => b._id === deliveryBoyId);
             dispatch(updateOrderAssignedBoy({ orderId, shopId, boy }));
             setAvailableBoys([]);
        } catch (error) {
             alert(error.response?.data?.message || 'Error assigning delivery boy');
             console.log(error);
        }
    }


  
    return (
        <div className='bg-white rounded-lg shadow p-4 space-y-4'>
            <div>
                <h2 className='text-lg font-semibold text-gray-800'>{data.user.fullName}</h2>
                <p className='text-sm text-gray-500'>{data.user.email}</p>
                <p className='flex items-center gap-2 text-sm text-gray-600 mt-1'><MdPhone /><span>{data.user.mobile}</span></p>
                {data.paymentMethod=="online"?<p className='gap-2 text-sm text-gray-600'>payment: {data.payment?"true":"false"}</p>:<p className='gap-2 text-sm text-gray-600'>Payment Method: {data.paymentMethod}</p>}
                
            </div>

            <div className='flex items-start flex-col gap-2 text-gray-600 text-sm'>
                <p>{data?.deliveryAddress?.text}</p>
                <p className='text-xs text-gray-500'>Lat: {data?.deliveryAddress.latitude} , Lon {data?.deliveryAddress.longitude}</p>
            </div>

            <div className='flex space-x-4 overflow-x-auto pb-2'>
                {data.shopOrders.shopOrderItems.map((item, index) => (
                    <div key={index} className='flex-shrink-0 w-40 border rounded-lg p-2 bg-white'>
                        <img src={item.item.image} alt="" className='w-full h-24 object-cover rounded' />
                        <p className='text-sm font-semibold mt-1'>{item.name}</p>
                        <p className='text-xs text-gray-500'>Qty: {item.quantity} x ₹{item.price}</p>
                    </div>
                ))}
            </div>

<div className='flex justify-between items-center mt-auto pt-3 border-t border-gray-100'>
<span className='text-sm'>status: <span className={`font-semibold capitalize ${data.shopOrders.status === 'cancelled' ? 'text-red-500' : 'text-[#ff4d2d]'}`}>{data.shopOrders.status}</span>
</span>

{data.shopOrders.status !== 'delivered' && data.shopOrders.status !== 'cancelled' && (
   <select  className='rounded-md border px-3 py-1 text-sm focus:outline-none focus:ring-2 border-[#ff4d2d] text-[#ff4d2d]' onChange={(e)=>handleUpdateStatus(data._id,data.shopOrders.shop._id,e.target.value)}>
       <option value="">Change</option>
       <option value="pending">Pending</option>
       <option value="preparing">Preparing</option>
       <option value="pending_assignment">Ready for Delivery</option>
       <option value="cancelled">Cancelled</option>
   </select>
)}

</div>

{data.shopOrders.status=="pending_assignment" && 
<div className="mt-3 p-3 border rounded-lg text-sm bg-orange-50 gap-4">
    {data.shopOrders.assignedDeliveryBoy?<p className="font-bold border-b pb-2 mb-2 text-gray-700">Assigned Delivery Boy:</p>:<p className="font-bold border-b pb-2 mb-2 text-gray-700">Available Delivery Boys:</p>}
   {availableBoys?.length>0?(
     <ul className='space-y-3 mt-2'>
     {availableBoys.map((b,index)=>(
        <li key={index} className='flex justify-between items-center bg-white p-2 rounded shadow-sm border border-orange-100'>
            <div>
               <p className='font-bold text-gray-800'>{b.fullName}</p>
               <p className='text-xs text-gray-500'>📞 {b.mobile}</p>
            </div>
            <button 
              className='bg-orange-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-orange-600 transition shadow'
              onClick={() => handleAssignBoy(data._id, data.shopOrders.shop._id, b._id)}
            >
              Assign
            </button>
        </li>
     ))}
     </ul>
   ):data.shopOrders.assignedDeliveryBoy?<div className="font-medium text-orange-600">{data.shopOrders.assignedDeliveryBoy.fullName} • {data.shopOrders.assignedDeliveryBoy.mobile}</div>:<div className="text-gray-500 italic">Waiting for delivery boy to accept natively...</div>}
</div>}

<div className='text-right font-bold text-gray-800 text-sm'>
 Total: ₹{data.shopOrders.subtotal}
</div>
        </div>
    )
}

export default OwnerOrderCard
