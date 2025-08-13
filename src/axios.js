// src/axios.js
import axios from 'axios'

// 1) Axios 인스턴스 생성
const api = axios.create({
  baseURL:
    process.env.REACT_APP_API_BASE_URL ||
    'https://port-0-ychat-lzgmwhc4d9883c97.sel4.cloudtype.app/',
  timeout: 10000,
  headers: {
    // 기본 JSON 헤더는 Accept만 남깁니다.
    Accept: 'application/json',
  },
})

// 2) 요청 인터셉터: localStorage에 저장된 mallId/userId를 헤더에 자동 추가
api.interceptors.request.use(
  config => {
    const mallId = localStorage.getItem('mallId')
    const userId = localStorage.getItem('userId')

    if (mallId) config.headers['X-Mall-Id'] = mallId
    if (userId) config.headers['X-User-Id'] = userId

    // FormData 업로드 시 기본 Content-Type 삭제 → axios가 올바른 multipart 헤더를 세팅
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }

    return config
  },
  error => Promise.reject(error)
)

// 3) 응답 인터셉터: 공통 에러 처리 (예: 401 Unauthorized → 로그인 페이지로 이동)
api.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status
    if (status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
