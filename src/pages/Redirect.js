// src/pages/Redirect.jsx
import React, { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../axios'

export default function Redirect() {
  const navigate = useNavigate()
  const { search } = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(search)
    const mallId = params.get('mall_id') || params.get('state')
    if (!mallId) {
      console.error('mall_id가 없습니다')
      return navigate('/', { replace: true })
    }

    // (1) localStorage에 우선 저장
    localStorage.setItem('mallId', mallId)

    // (2) 백엔드에서 실제 설치 정보를 가져와 덮어쓰기
    axios.get(`/api/${mallId}/mall`)
      .then(({ data }) => {
        localStorage.setItem('mallId',   data.mallId)
        if (data.userId)   localStorage.setItem('userId',   data.userId)
        if (data.userName) localStorage.setItem('userName', data.userName)
      })
      .catch(err => console.warn(err))
      .finally(() => {
        navigate('/', { replace: true })
      })
  }, [search, navigate])

  return null
}
