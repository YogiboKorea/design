// src/pages/StatEventVisitors.jsx

import React, { useEffect, useState } from 'react';
import {
  Card,
  Select,
  DatePicker,
  Button,
  Table,
  Space,
  message,
  Grid,
} from 'antd';
import api from '../axios';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import './NormalSection.css';

dayjs.extend(isSameOrBefore);

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

export default function StatEventVisitors() {
  // ─── mallId 결정 ─────────────────────────────────────────
  const [mallId, setMallId] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('mall_id') || params.get('state') || params.get('mallId');
    if (q) {
      localStorage.setItem('mallId', q);
      setMallId(q);
    } else {
      const stored = localStorage.getItem('mallId');
      if (stored) setMallId(stored);
      else message.error('mall_id 파라미터가 없습니다.');
    }
  }, []);

  const screens = useBreakpoint();
  const isMobile = !screens.sm;

  // ─── 상태 선언 ───────────────────────────────────────────
  const [events, setEvents]               = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [urls, setUrls]                   = useState([]);
  const [selectedUrl, setSelectedUrl]     = useState(null);

  const [range, setRange]                 = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [minDate, setMinDate]             = useState(null);

  const [data, setData]                   = useState([]);
  const [loading, setLoading]             = useState(false);

  // ─── helper: 선행 '/', 숫자-segment, skin-mobile, skin-<anything> 반복 제거 후 정규화 ----
  const normalizePath = (urlCandidate) => {
    if (!urlCandidate) return '/';
    // 절대 URL이면 그대로 반환 (http(s) 포함)
    if (/^https?:\/\//i.test(urlCandidate)) return urlCandidate;

    let s = String(urlCandidate).trim();

    // remove leading slashes so patterns match consistently ("/67/test.html" -> "67/test.html")
    s = s.replace(/^\/+/, '');
    if (!s) return '/';

    // patterns to strip repeatedly from the start:
    // - skin-mobile/
    // - skin-<anything>/   (covers skin-skin98 etc)
    // - numeric segment like "67/" or "123/"
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

  const displayLabel = (u) => {
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return normalizePath(u);
  };

  // ─── 1) 이벤트 목록 로드 & 기본 설정 ───────────────────────
  useEffect(() => {
    if (!mallId) return;
    api.get(`/api/${mallId}/events`)
      .then(res => {
        const opts = (res.data || [])
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(ev => ({
            label:     ev.title || '(제목없음)',
            value:     ev._id,
            createdAt: ev.createdAt,
          }));
        setEvents(opts);
        if (opts.length) {
          const { value, createdAt } = opts[0];
          setSelectedEvent(value);
          const start = dayjs(createdAt);
          setMinDate(start);
          setRange([start, dayjs()]);
        }
      })
      .catch(err => {
        console.error('[EVENTS LOAD ERROR]', err);
        message.error('이벤트 목록을 불러오지 못했습니다.');
      });
  }, [mallId]);

  // ─── 2) URL 목록 & 날짜 최소값 재설정 ───────────────────────
  useEffect(() => {
    if (!mallId || !selectedEvent) {
      setUrls([]);
      setSelectedUrl(null);
      setMinDate(null);
      return;
    }

    // URL 목록
    api.get(`/api/${mallId}/analytics/${selectedEvent}/urls`)
      .then(res => {
        const list = res.data || [];
        setUrls(list);
        setSelectedUrl(list[0] || null);
      })
      .catch(err => {
        console.error('[URLS LOAD ERROR]', err);
        message.error('URL 목록을 불러오지 못했습니다.');
        setUrls([]);
        setSelectedUrl(null);
      });

    // 최소날짜(이벤트 생성일)
    const ev = events.find(e => e.value === selectedEvent);
    if (ev) {
      const start = dayjs(ev.createdAt);
      setMinDate(start);
      setRange([start, dayjs()]);
    }
  }, [mallId, selectedEvent, events]);

  // ─── 3) 방문자 통계 조회 ───────────────────────────────────
  const fetchStats = async () => {
    if (!mallId || !selectedEvent) {
      message.warning('이벤트를 선택하세요.');
      return;
    }
    if (!selectedUrl) {
      message.warning('URL을 선택하세요.');
      return;
    }

    setLoading(true);
    const [start, end] = range.map(d => d.format('YYYY-MM-DD'));
    try {
      const normalizedSelected = normalizePath(selectedUrl);

      const visRes = await api.get(
        `/api/${mallId}/analytics/${selectedEvent}/visitors-by-date`,
        {
          params: {
            start_date: `${start}T00:00:00+09:00`,
            end_date:   `${end}T23:59:59.999+09:00`,
            url:        normalizedSelected,
          }
        }
      );
      const raw = Array.isArray(visRes.data) ? visRes.data : [];

      // 빈 날짜 0으로 채우기
      const lookup = new Map(raw.map(o => [o.date, o]));
      const days = [];
      let cur = range[0].startOf('day'),
          last = range[1].startOf('day');
      while (cur.isSameOrBefore(last, 'day')) {
        days.push(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }

      const tableData = days.map(date => {
        const o = lookup.get(date) || {};
        return {
          key:               date,
          date,
          totalVisitors:     o.totalVisitors     || 0,
          newVisitors:       o.newVisitors       || 0,
          returningVisitors: o.returningVisitors || 0,
          revisitRate:       o.revisitRate       || '0 %',
        };
      });

      setData(tableData);
    } catch (err) {
      console.error('[STATS LOAD ERROR]', err);
      message.error('통계 데이터를 불러오지 못했습니다.');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // ─── 4) 선택 변경 시 자동 조회 ─────────────────────────────
  useEffect(() => {
    if (mallId && selectedEvent && selectedUrl) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mallId, selectedEvent, selectedUrl, range]);

  // ─── 5) 테이블 컬럼 정의 ─────────────────────────────────
  const columns = [
    { title: '날짜',        dataIndex: 'date',              key: 'date' },
    { title: '총 방문자',   dataIndex: 'totalVisitors',     key: 'totalVisitors',     align: 'right' },
    { title: '신규 방문자', dataIndex: 'newVisitors',       key: 'newVisitors',       align: 'right' },
    { title: '재방문자',    dataIndex: 'returningVisitors', key: 'returningVisitors', align: 'right' },
    { title: '재방문 비율', dataIndex: 'revisitRate',       key: 'revisitRate',       align: 'right' },
  ];

  return (
    <Card
      className="pageView"
      title="이벤트 방문자 통계 (일별)"
      extra={(
        <Space wrap size={isMobile ? 'small' : 'middle'} style={isMobile ? { width:'100%' } : undefined}>
          <Select
            placeholder="이벤트 선택"
            options={events}
            value={selectedEvent}
            onChange={setSelectedEvent}
            allowClear
            style={{ width: isMobile ? '100%' : 200, minWidth: 120 }}
          />
          <Select
            placeholder="URL 선택"
            options={urls.map(u => ({ label: displayLabel(u), value: u }))}
            value={selectedUrl}
            onChange={setSelectedUrl}
            allowClear
            style={{ width: isMobile ? '100%' : 240, minWidth: 120 }}
          />

          {isMobile ? (
            <Space direction="vertical" size="small" style={{ width:'100%' }}>
              <DatePicker
                value={range[0]}
                format="YYYY-MM-DD"
                onChange={d => d && setRange([d, range[1]])}
                disabledDate={d => minDate && d.isBefore(minDate, 'day')}
                style={{ width:'100%' }}
                allowClear={false}
              />
              <DatePicker
                value={range[1]}
                format="YYYY-MM-DD"
                onChange={d => d && setRange([range[0], d])}
                disabledDate={d => minDate && d.isBefore(minDate, 'day')}
                style={{ width:'100%' }}
                allowClear={false}
              />
            </Space>
          ) : (
            <RangePicker
              value={range}
              format="YYYY-MM-DD"
              onChange={setRange}
              disabledDate={d => minDate && d.isBefore(minDate, 'day')}
              style={{ width: 280, minWidth: 160 }}
              allowClear={false}
            />
          )}

          <Button type="primary" loading={loading} onClick={fetchStats} block={isMobile}>
            조회
          </Button>
        </Space>
      )}
      style={{ width:'100%', maxWidth:1700, margin:'0 auto' }}
      bodyStyle={{ padding: isMobile ? 12 : 24 }}
    >
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        bordered
        locale={{ emptyText: '조회된 데이터가 없습니다.' }}
        scroll={{ x: isMobile ? 'max-content' : undefined }}
      />
    </Card>
  );
}
