import React from 'react'
import { UserDataContext } from './context/UserContext'
import { useNavigate } from 'react-router-dom'
import { useContext, useEffect, useState } from 'react'
import axios from 'axios'

const UserProtectedWrapper = ({children}) => {
    const { user, setUser } = useContext(UserDataContext);
    const token = localStorage.getItem('token');
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        axios.get(`${import.meta.env.VITE_BASE_URL}/users/profile`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
        })
        .then((Response)=>{
            if(Response.status === 200) {
                const data = Response.data;
                setUser(data.user);
                setIsLoading(false);
            }
        })
        .catch((error) => {
            console.error("Error fetching user profile:", error);
            setIsLoading(false);
            localStorage.removeItem('token');
            navigate('/login');
        });
    }, [token, navigate, setUser]);
        if(isLoading){
            <div>Loading...</div>
        }
  return <>{children}</>
}

export default UserProtectedWrapper