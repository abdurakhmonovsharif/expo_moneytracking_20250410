import React from 'react';
import { RefreshControl } from 'react-native';
import { Button, Icon, StyleService, TopNavigation, useStyleSheet } from '@ui-kitten/components';
import { Container, Content, LayoutCustom, NavigationAction, Text } from 'components';
import { useFocusEffect } from '@react-navigation/native';
import {
  AppNotification,
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from 'services/notificationsService';
import { useTranslation } from 'i18n/useTranslation';
import dayjs from 'dayjs';
import { runWithAppRequest } from 'reduxs/requestLoading';

const formatNotificationTime = (value?: string) => {
  if (!value) return '';
  const dt = dayjs(value);
  if (!dt.isValid()) return '';
  return dt.format('DD MMM, HH:mm');
};

const NotificationsScreen = React.memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { language, t } = useTranslation();
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);

  const unreadCount = React.useMemo(() => {
    return items.reduce((sum, item) => sum + (item.is_read ? 0 : 1), 0);
  }, [items]);

  const loadNotifications = React.useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const response = await runWithAppRequest(() =>
          listMyNotifications({ limit: 100, language })
        );
        setItems(response.items ?? []);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [language]
  );

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications(false).catch(() => {});
      return () => {};
    }, [loadNotifications])
  );

  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount <= 0) {
      return;
    }
    setMarkingAll(true);
    try {
      await runWithAppRequest(() => markAllMyNotificationsRead());
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at ?? new Date().toISOString(),
        }))
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const handlePressItem = async (item: AppNotification) => {
    if (item.is_read) {
      return;
    }
    setItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              is_read: true,
              read_at: new Date().toISOString(),
            }
          : entry
      )
    );
    try {
      await runWithAppRequest(() => markMyNotificationRead(item.id));
    } catch {
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                is_read: false,
                read_at: null,
              }
            : entry
        )
      );
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        alignment="center"
        title={t('Notifications')}
        accessoryLeft={() => <NavigationAction />}
        accessoryRight={() => (
          <Button
            size="tiny"
            appearance="ghost"
            style={styles.markAllButton}
            accessoryLeft={(props) => (
              <Icon {...props} pack="assets" name="check" style={styles.markAllIcon} />
            )}
            disabled={markingAll || unreadCount <= 0}
            onPress={handleMarkAllRead}
          />
        )}
      />
      <Content
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true).catch(() => {})}
          />
        }
      >
        {loading && items.length === 0 ? (
          <LayoutCustom style={styles.emptyContainer} itemsCenter>
            <Text category="c1" status="content">
              {t('Loading...')}
            </Text>
          </LayoutCustom>
        ) : items.length === 0 ? (
          <LayoutCustom style={styles.emptyContainer} itemsCenter>
            <Icon pack="assets" name="bell-simple" style={styles.emptyIcon} />
            <Text category="subhead" status="content">
              {t('No notifications yet.')}
            </Text>
          </LayoutCustom>
        ) : (
          <LayoutCustom style={styles.list}>
            {items.map((item) => {
              return (
                <LayoutCustom
                  key={item.id}
                  style={[
                    styles.item,
                    !item.is_read && styles.itemUnread,
                  ]}
                  onPress={() => handlePressItem(item)}
                >
                  <LayoutCustom horizontal justify="space-between" itemsCenter>
                    <Text category="subhead" style={styles.title}>
                      {item.title}
                    </Text>
                    {!item.is_read ? (
                      <LayoutCustom style={styles.unreadDot} />
                    ) : (
                      <Text category="c2" status="content">
                        {t('Read')}
                      </Text>
                    )}
                  </LayoutCustom>
                  <Text category="c1" status="content">
                    {item.body}
                  </Text>
                  <Text category="c2" status="content">
                    {formatNotificationTime(item.created_at)}
                  </Text>
                </LayoutCustom>
              );
            })}
          </LayoutCustom>
        )}
      </Content>
    </Container>
  );
});

export default NotificationsScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  list: {
    gap: 12,
  },
  item: {
    borderRadius: 12,
    backgroundColor: 'background-basic-color-2',
    padding: 12,
    gap: 8,
  },
  itemUnread: {
    borderWidth: 1,
    borderColor: 'color-primary-default',
  },
  title: {
    flex: 1,
    paddingRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: 'color-danger-default',
  },
  emptyContainer: {
    marginTop: 80,
    gap: 12,
  },
  emptyIcon: {
    width: 28,
    height: 28,
    tintColor: 'text-content-color',
  },
  markAllButton: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 4,
  },
  markAllIcon: {
    width: 20,
    height: 20,
  },
});
