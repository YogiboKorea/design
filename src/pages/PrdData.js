// src/pages/PrdData.jsx

import React, { useEffect, useState } from 'react';
import { Card, Select, Button, Table, Space, message, Grid } from 'antd';
import dayjs from 'dayjs';
import api from '../axios';
import './NormalSection.css'

const { useBreakpoint } = Grid;

export default function PrdData() {
  const screens = useBreakpoint();
  const isMobile = !screens.sm;
  const mallId = localStorage.getItem('mallId');

  // ─── 상태 선언 ───────────────────────────────────────────────
  const [events, setEvents]               = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [minDate, setMinDate]             = useState(null);
  const [data, setData]                   = useState([]);
  const [loading, setLoading]             = useState(false);

  // ─── 1) 이벤트 목록 로드 ─────────────────────────────────────
  useEffect(() => {
    if (!mallId) return;
    api.get(`/api/${mallId}/events`)
      .then(res => {
        const evs = (res.data || [])
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setEvents(evs);
        if (evs.length) {
          // 가장 최신으로 셋업
          setSelectedEvent(evs[0]._id);
          setMinDate(dayjs(evs[0].createdAt));
        }
      })
      .catch(() => message.error('이벤트 목록을 불러오지 못했습니다.'));
  }, [mallId]);

  // ─── 1-2) selectedEvent 변경 시 minDate를 이벤트 생성일로 재설정 ─────────
  useEffect(() => {
    if (!selectedEvent) return;
    const ev = events.find(e => e._id === selectedEvent);
    if (ev?.createdAt) {
      setMinDate(dayjs(ev.createdAt));
    }
  }, [selectedEvent, events]);

  // ─── 2) selectedEvent 또는 minDate 바뀔 때마다 자동 조회 ──────
  useEffect(() => {
    if (selectedEvent && minDate) {
      fetchPerformance();
    }
  }, [selectedEvent, minDate]);

  // ─── 3) 상품 클릭 퍼포먼스 조회 ───────────────────────────────────
  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const start = minDate.format('YYYY-MM-DD');
      const end   = dayjs().format('YYYY-MM-DD');

      const { data: perf } = await api.get(
        `/api/${mallId}/analytics/${selectedEvent}/product-performance`,
        {
          params: {
            start_date: `${start}T00:00:00+09:00`,
            end_date:   `${end}T23:59:59.999+09:00`,
          }
        }
      );

      // 클릭수 내림차순 정렬
      const sorted = (perf || []).slice().sort((a, b) => b.clicks - a.clicks);
      setData(sorted);
    } catch (err) {
      console.error('[PRODUCT PERFORMANCE ERROR]', err);
      message.error('상품 퍼포먼스 조회 실패');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // ─── 카드 제목에 날짜 범위 표시 ─────────────────────────────────
  const title = minDate
    ? `상품 클릭 퍼포먼스 (${minDate.format('YYYY-MM-DD')} ~ ${dayjs().format('YYYY-MM-DD')})`
    : '상품 클릭 퍼포먼스';

  // ─── 렌더링 ────────────────────────────────────────────────
  return (
    <Card
     className="prddata"
      title={title}
      extra={(
        <Space
          wrap
          size={isMobile ? 'small' : 'middle'}
          style={isMobile ? { width: '100%' } : undefined}
        >
          <Select
            placeholder="이벤트 선택"
            options={events.map(e => ({
              label: e.title || '(제목없음)',
              value: e._id,
            }))}
            value={selectedEvent}
            onChange={val => setSelectedEvent(val)}
            style={{ width: isMobile ? '100%' : 200 }}
          />
          <Button
            type="primary"
            loading={loading}
            onClick={fetchPerformance}
            block={isMobile}
          >
            조회
          </Button>
        </Space>
      )}
      style={{ width: '100%', maxWidth: 1800, margin: '0 auto' }}
      bodyStyle={{ padding: isMobile ? 12 : 24 }}
    >
      <Table
        rowKey="productNo"
        loading={loading}
        dataSource={data}
        pagination={false}
        bordered
        scroll={{ x: isMobile ? 'max-content' : undefined }}
        locale={{ emptyText: '데이터가 없습니다.' }}
        columns={[
          { title: '순위',       key: 'rank',      render: (_t, _r, i) => i + 1 },
          { title: '상품번호',   dataIndex: 'productNo',   key: 'productNo' },
          { title: '상품명',     dataIndex: 'productName', key: 'productName' },
          { title: '클릭수',     dataIndex: 'clicks',      key: 'clicks', align: 'right',
            sorter: (a, b) => a.clicks - b.clicks, defaultSortOrder: 'descend'
          },
          // 클릭율은 제거하셨으니 컬럼에서 빼두었습니다
        ]}
      />
    </Card>
  );
}
