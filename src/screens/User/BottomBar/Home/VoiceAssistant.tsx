import React from "react";
import {
  Button,
  Icon,
  Input,
  StyleService,
  useStyleSheet,
} from "@ui-kitten/components";
import { LayoutCustom, LinearGradientText, Text } from "components";
import { useTranslation } from "i18n/useTranslation";
import { useCurrencyConversion, useCurrencyFormatter } from "hooks";
import { VoiceAnalysis } from "services/voiceAiService";

type VoiceAssistantProps = {
  value: string;
  onChange: (text: string) => void;
  onAddIncome: () => void;
  onAddExpense: () => void;
  onApprove?: () => void;
  onCancel?: () => void;
  loading?: boolean;
  analyzing?: boolean;
  recording?: boolean;
  transcribing?: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  metering?: number;
  analysis?: VoiceAnalysis | null;
  analysisTypeHint?: "income" | "expense" | null;
};

const VoiceAssistant = ({
  value,
  onChange,
  onAddIncome,
  onAddExpense,
  onApprove,
  onCancel,
  loading = false,
  analyzing = false,
  recording = false,
  transcribing = false,
  onStartRecording,
  onStopRecording,
  metering = 0,
  analysis = null,
  analysisTypeHint = null,
}: VoiceAssistantProps) => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation();
  const formatCurrency = useCurrencyFormatter();
  const { convert } = useCurrencyConversion();

  const waveWeights = [0.2, 0.35, 0.6, 1, 0.6, 0.35, 0.2];
  const level = recording ? Math.max(0.05, Math.min(1, metering)) : 0;

  const playIcon = (props: any) => (
    <Icon {...props} pack="assets" name="play" style={styles.controlIcon} />
  );
  const stopIcon = (props: any) => (
    <Icon {...props} pack="eva" name="square" style={styles.controlIcon} />
  );
  const incomeIcon = (props: any) => (
    <Icon {...props} pack="assets" name="arrow-up" style={styles.actionIcon} />
  );
  const expenseIcon = (props: any) => (
    <Icon {...props} pack="assets" name="arrow-down" style={styles.actionIcon} />
  );

  const resolvedType =
    analysis?.type === "income" || analysis?.type === "expense"
      ? analysis.type
      : analysisTypeHint;

  return (
    <LayoutCustom style={styles.container} level="2">
      {/* Header */}
      <LayoutCustom itemsCenter gap={4}>
        <LinearGradientText text="Voice AI" category="h5" />
        <Text category="c2" status="content" center>
          Say: "income 120 salary" or "expense 15 lunch"
        </Text>
      </LayoutCustom>

      {/* Mic Area */}
      <LayoutCustom style={styles.micArea}>
        {recording && (
          <LayoutCustom horizontal gap={6} style={styles.waveform}>
            {waveWeights.map((w, i) => (
              <LayoutCustom
                key={i}
                style={[
                  styles.waveBar,
                  { height: 6 + level * 28 * w },
                ]}
              />
            ))}
          </LayoutCustom>
        )}

        <LayoutCustom style={styles.recordControls}>
          <Button
            status="primary"
            appearance={recording ? "outline" : "filled"}
            onPress={onStartRecording}
            accessoryLeft={playIcon}
            disabled={recording || transcribing || analyzing}
            style={styles.recordButton}
          >
            {t("Record")}
          </Button>

          <Button
            status="danger"
            appearance={recording ? "filled" : "outline"}
            onPress={onStopRecording}
            accessoryLeft={stopIcon}
            disabled={!recording || transcribing || analyzing}
            style={styles.recordButton}
          >
            {t("Stop")}
          </Button>
        </LayoutCustom>

        {recording && <Text category="c2">Recording...</Text>}
        {transcribing && <Text category="c2">Transcribing...</Text>}
      </LayoutCustom>

      {/* Text Input */}
      <Input
        placeholder={t("Your voice will appear here")}
        value={value}
        onChangeText={onChange}
        multiline
        textStyle={styles.inputText}
        style={styles.input}
      />

      {/* Analysis / Actions */}
      {analysis ? (
        <LayoutCustom style={styles.analysisCard} level="2">
          <LayoutCustom horizontal justify="space-between" itemsCenter>
            <Text category="s1">
              {resolvedType === "income" ? t("Income") : t("Expense")}
            </Text>
            <Text category="h6">
              {analysis.amount != null
                ? formatCurrency(
                    convert(Number(analysis.amount), analysis.currency),
                    2
                  )
                : "-"}
            </Text>
          </LayoutCustom>

          {analysis.category && (
            <Text category="c1">
              {t("Category")}: {analysis.category}
            </Text>
          )}

          {(analysis.description || value) && (
            <Text category="c1">{analysis.description || value}</Text>
          )}

          <LayoutCustom style={styles.actionRowHorizontal}>
            <Button
              appearance="outline"
              onPress={onCancel}
              disabled={loading || recording || transcribing}
              style={styles.action}
            >
              {t("Cancel")}
            </Button>

            <Button
              onPress={onApprove}
              disabled={loading || recording || transcribing}
              style={styles.action}
            >
              {t("Confirm")}
            </Button>
          </LayoutCustom>
        </LayoutCustom>
      ) : (
        <LayoutCustom style={styles.actionRowVertical}>
          <Button
            status="primary"
            accessoryLeft={incomeIcon}
            onPress={onAddIncome}
            disabled={loading || recording || transcribing || analyzing}
            style={styles.action}
          >
            {t("Add Income")}
          </Button>

          <Button
            status="danger"
            appearance="outline"
            accessoryLeft={expenseIcon}
            onPress={onAddExpense}
            disabled={loading || recording || transcribing || analyzing}
            style={styles.action}
          >
            {t("Add Expense")}
          </Button>
        </LayoutCustom>
      )}
    </LayoutCustom>
  );
};

export default VoiceAssistant;

const themedStyles = StyleService.create({
  container: {
    borderRadius: 16,
    padding: 14,
    gap: 12,
    width: "100%",
  },
  micArea: {
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  waveform: {
    minHeight: 28,
  },
  waveBar: {
    width: 5,
    borderRadius: 6,
    backgroundColor: "color-primary-default",
  },
  recordControls: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  recordButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
  },
  input: {
    borderRadius: 12,
  },
  inputText: {
    minHeight: 50,
    fontSize: 13,
    lineHeight: 18,
  },
  action: {
    width: "100%",
    minHeight: 46,
    borderRadius: 14,
  },
  actionRowVertical: {
    width: "100%",
    gap: 10,
  },
  actionRowHorizontal: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  analysisCard: {
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  controlIcon: {
    width: 16,
    height: 16,
  },
  actionIcon: {
    width: 16,
    height: 16,
  },
});
