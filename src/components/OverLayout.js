// src/layouts/OverlayLayout.jsx

import React, { useState, useEffect } from 'react';
import { Layout, Drawer, Button, Grid } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import Sidebar from '../components/Sidebar';
import AppHeader from '../components/AppHeader';
import './Sidebar.css';

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

export default function OverlayLayout({ children }) {
  // 화면 크기 감지
  const screens  = useBreakpoint();
  const isMobile = !screens.sm;    // sm (≥576px) 이 false 면 모바일 모드

  // 상태 분리: 모바일 Drawer, 데스크탑 Sider
  const [drawerVisible, setDrawerVisible]   = useState(false);
  const [siderCollapsed, setSiderCollapsed] = useState(false);

  // 모바일 헤더용 mallId 라벨
  const [label, setLabel] = useState('GUEST');
  useEffect(() => {
    const id = localStorage.getItem('mallId');
    if (id) setLabel(id);
  }, []);

  // 브레이크포인트 변경 시 상태 초기화 (무한루프 방지)
  useEffect(() => {
    setDrawerVisible(false);
    setSiderCollapsed(false);
  }, [isMobile]);

  // 메뉴 토글 함수
  const toggleMenu = () => {
    if (isMobile) {
      setDrawerVisible(v => !v);
    } else {
      setSiderCollapsed(c => !c);
    }
  };

  // ─── 모바일 모드: 헤더 + Drawer + 콘텐츠 ─────────────────
  if (isMobile) {
    return (
      <Layout className="overlay-layout">
        {/* 1) 헤더: 햄버거 + 회원정보 */}
        <Header className="app-header overlay-header" style={{ padding: 0 }}>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={toggleMenu}
            className="overlay-trigger hamButton"
          />
          <div className="header-right">
            <span className="membership-label free">
              {label}
            </span>
            <img
              src="https://yogibo.kr/yogico/img/icon/symbol.png"
              alt="회원 아바타"
              className="membership-avatar"
            />
          </div>
        </Header>

        {/* 2) Drawer: 오버레이 메뉴 */}
        <Drawer
          open={drawerVisible}
          placement="left"
          closable={false}
          onClose={toggleMenu}
          bodyStyle={{ padding: 0 }}
          width={240}
        >
          <Sidebar collapsed={false} onToggle={toggleMenu} />
        </Drawer>

        {/* 3) 콘텐츠 */}
        <Content className="overlay-content" style={{ margin: 0, padding: 16 }}>
          {children}
        </Content>
      </Layout>
    );
  }

  // ─── 데스크탑 모드: Sider + AppHeader + 콘텐츠 ───────────────
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={siderCollapsed}
        onCollapse={setSiderCollapsed}
        width={240}
        collapsedWidth={80}
        style={{ position: 'fixed', height: '100vh', zIndex: 100 }}
      >
        <Sidebar collapsed={siderCollapsed} onToggle={toggleMenu} />
      </Sider>

      <Layout style={{
        marginLeft: siderCollapsed ? 80 : 240,
        transition: 'margin-left 0.2s ease'
      }}>
        <AppHeader
          collapsed={siderCollapsed}
          onToggle={toggleMenu}
        />
        <Content style={{ margin: 16, padding: 16 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
