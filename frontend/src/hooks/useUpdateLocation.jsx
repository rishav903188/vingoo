import axios from 'axios'
import React, { useEffect } from 'react'
import { serverUrl } from '../App'
import { useSelector } from 'react-redux'

function useUpdateLocation() {
    const {userData}=useSelector(state=>state.user)

    useEffect(()=>{
        if(!userData) return // don't watch if not logged in

        const updateLocation=async (lat,lon) => {
            try {
                await axios.post(`${serverUrl}/api/user/update-location`,{lat,lon},{withCredentials:true})
            } catch(e) {
                // silently ignore — non-critical
            }
        }

        const watchId = navigator.geolocation.watchPosition((pos)=>{
            updateLocation(pos.coords.latitude,pos.coords.longitude)
        }, (err)=>{
            console.warn("Location watch error:", err.message)
        })

        return () => {
            navigator.geolocation.clearWatch(watchId)
        }
    },[userData?._id]) // only restart watch if the user identity changes, not on every userData update
}

export default useUpdateLocation
