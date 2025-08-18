// src/pages/PrdData.jsx

import React, { useEffect, useState } from 'react';
import { Card, Select, Button, Table, Space, message, Grid } from 'antd';
import dayjs from 'dayjs';
import api from '../axios';
import './NormalSection.css'

const { useBreakpoint } = Grid;
const SITE_BASE = 'https://yogibo.kr';

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

  // ─── helper: 선행 '/', 숫자-segment, skin-mobile, skin-<anything> 반복 제거 후 정규화 ----
  const normalizePath = (urlCandidate) => {
    if (!urlCandidate) return '/';
    // 절대 URL이면 그대로 반환
    if (/^https?:\/\//i.test(urlCandidate)) return urlCandidate;

    let s = String(urlCandidate).trim();

    // 1) remove leading slashes so patterns match consistently ("/67/test.html" -> "67/test.html")
    s = s.replace(/^\/+/, '');
    if (!s) return '/';

    // 2) patterns to strip repeatedly from the start:
    //    - skin-mobile/
    //    - skin-<anything>/   (covers skin-skin98 etc)
    //    - numeric segment like "67/" or "123/"
    const patterns = [
      /^skin-mobile\/?/i,
      /^skin-[^\/]+\/?/i,
      /^\d+\/?/
    ];

    let changed = true;
    while (changed) {
      changed = false;
      for (const p of patterns) {
        if (p.test(s)) {
          s = s.replace(p, '');
          changed = true;
        }
      }
    }

    if (!s) return '/';
    if (!s.startsWith('/')) s = '/' + s;
    return s;
  };

  const displayLabelForUrl = (u) => {
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return normalizePath(u);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent, minDate]);

  // copy helper: 복사 (절대 URL이면 그대로, 아니면 SITE_BASE + path)
  const copyToClipboard = async (urlCandidate) => {
    if (!urlCandidate) {
      message.warning('복사할 링크가 없습니다.');
      return;
    }
    const full = /^https?:\/\//i.test(urlCandidate) ? urlCandidate : `${SITE_BASE}${normalizePath(urlCandidate)}`;
    try {
      await navigator.clipboard.writeText(full);
      message.success(`복사되었습니다: ${full}`);
    } catch (e) {
      message.error('클립보드에 복사하지 못했습니다.');
    }
  };

  // open helper: 새 탭으로 열기
  const openInNewTab = (urlCandidate) => {
    if (!urlCandidate) {
      message.warning('열 링크가 없습니다.');
      return;
    }
    const full = /^https?:\/\//i.test(urlCandidate) ? urlCandidate : `${SITE_BASE}${normalizePath(urlCandidate)}`;
    try {
      window.open(full, '_blank');
    } catch (e) {
      message.error('새 창을 열 수 없습니다.');
    }
  };

  // ─── 3) 상품 클릭 퍼포먼스 조회 ───────────────────────────────────
  const fetchPerformance = async () => {
    if (!mallId || !selectedEvent) {
      message.warning('이벤트를 선택해주세요.');
      return;
    }
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

      // 방어적으로 productUrl/url/link 필드가 있으면 정규화해서 추가
      const mapped = (perf || []).map(item => {
        const rawUrl = item.productUrl || item.url || item.link || '';
        const normalized = rawUrl ? normalizePath(rawUrl) : '';
        return {
          ...item,
          _rawUrl: rawUrl,
          normalizedUrl: normalized,
        };
      });

      // 클릭수 내림차순 정렬
      const sorted = mapped.slice().sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
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
          {
            title: '링크',
            dataIndex: 'normalizedUrl',
            key: 'normalizedUrl',
            render: (val, record) => {
              if (!val) return '-';
              // val might be absolute URL (starting with http) or path like '/test.html'
              const display = /^https?:\/\//i.test(val) ? val : val;
              return (
                <Space size="small" wrap>
                  <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</span>
                  <Button size="small" onClick={() => openInNewTab(record._rawUrl || val)}>열기</Button>
                  <Button size="small" onClick={() => copyToClipboard(record._rawUrl || val)}>복사</Button>
                </Space>
              );
            }
          },
          { title: '클릭수',     dataIndex: 'clicks',      key: 'clicks', align: 'right',
            sorter: (a, b) => (a.clicks || 0) - (b.clicks || 0), defaultSortOrder: 'descend'
          },
        ]}
      />
    </Card>
  );
}
