import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function Admin() {
  const shop = localStorage.getItem('shop');
  const [categories, setCategories] = useState([]);
  const [coupons, setCoupons]       = useState([]);
  const [error, setError]           = useState(null);

  useEffect(() => {
    if (!shop) {
      setError('쇼핑몰 정보가 없습니다. 다시 로그인해주세요.');
      return;
    }

    // 1) 전체 카테고리 불러오기
    axios.get(`/api/${shop}/categories/all`)
      .then(res => setCategories(res.data))
      .catch(err => {
        console.error(err);
        setError('카테고리 조회 실패');
      });

    // 2) 전체 쿠폰 불러오기
    axios.get(`/api/${shop}/coupons`)
      .then(res => setCoupons(res.data))
      .catch(err => {
        console.error(err);
        setError('쿠폰 조회 실패');
      });
  }, [shop]);

  if (error) {
    return <div style={{ padding:20, color:'red' }}>🚨 {error}</div>;
  }

  return (
    <div style={{ padding:20 }}>
      <h1>관리자 페이지</h1>
      <p>쇼핑몰: <strong>{shop}</strong></p>

      <section>
        <h2>전체 카테고리 ({categories.length})</h2>
        <ul>
          {categories.map(cat => (
            <li key={cat.category_no}>
              [{cat.category_no}] {cat.category_name}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop:40 }}>
        <h2>전체 쿠폰 ({coupons.length})</h2>
        <ul>
          {coupons.map(c => (
            <li key={c.coupon_no}>
              [{c.coupon_no}] {c.coupon_name} — {c.benefit_text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
