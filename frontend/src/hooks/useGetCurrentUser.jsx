import axios from 'axios'
import React, { useEffect } from 'react'
import { serverUrl } from '../App'
import { useDispatch } from 'react-redux'
import { setAuthLoading, setUserData } from '../redux/userSlice'

function useGetCurrentUser() {
    const dispatch=useDispatch()
  useEffect(()=>{
  const fetchUser=async () => {
    try {
           const result=await axios.get(`${serverUrl}/api/user/current`,{withCredentials:true})
            dispatch(setUserData(result.data))
  
    } catch (error) {
        // user not logged in — that's fine, just clear auth loading
    } finally {
        dispatch(setAuthLoading(false))
    }
}
fetchUser()
 
  },[])
}

export default useGetCurrentUser
