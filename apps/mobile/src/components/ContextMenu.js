import React from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from 'contexts/ThemeContext'

/**
 * iOS ActionSheet 風のコンテキストメニュー
 * items: [{ label, icon, onPress, destructive? }]
 */
export default function ContextMenu({ visible, onClose, title, items }) {
  const { theme } = useTheme()
  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheetWrapper}>
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
            {title ? (
              <View style={[styles.titleRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.titleText, { color: theme.subText }]} numberOfLines={2}>
                  {title}
                </Text>
              </View>
            ) : null}
            {items.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.item,
                  { borderBottomColor: theme.border },
                  idx < items.length - 1 && styles.itemBorder,
                ]}
                onPress={() => { onClose(); item.onPress() }}
                activeOpacity={0.7}
              >
                <Text style={[styles.itemText, { color: item.destructive ? theme.bad : theme.accent }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: theme.surface }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    padding: 8,
    paddingBottom: 24,
    gap: 8,
  },
  sheet: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  titleRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  item: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemText: {
    fontSize: 17,
  },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
  },
})
