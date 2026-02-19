import React from "react";

// ----------------------------- UI kitten -----------------------------------
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
} from "@ui-kitten/components";

// ----------------------------- Hooks ---------------------------------------
import { useToggle } from "hooks";

// ----------------------------- Components && Elements -----------------------
import {
  Container,
  Content,
  LayoutCustom,
  NavigationAction,
  Text,
} from "components";
import ButtonSelectCategory from "./ButtonSelectCategory";
import { useTranslation } from "i18n/useTranslation";

// ----------------------------- Types ---------------------------------------
import { ICategoryProps } from "types/redux-types";
interface ISelectCategoryProps {
  onClose(): void;
  onSelect: React.Dispatch<React.SetStateAction<ICategoryProps>>;
  data: ICategoryProps[];
}

const SelectCategory: React.FC<ISelectCategoryProps> = ({
  data,
  onClose,
  onSelect,
}) => {
  const styles = useStyleSheet(themedStyles);
  const [colapse, toggle] = useToggle(false);
  const { t } = useTranslation();

  return (
    <Container style={styles.container} level="1">
      <TopNavigation
        title={t("Choose Category")}
        alignment="center"
        accessoryLeft={() => <NavigationAction onPress={onClose} />}
        accessoryRight={() => (
          <Text
            onPress={toggle}
            category="h5"
            status="warning"
            children={colapse ? "Collapse" : "Expand"}
          />
        )}
      />
      <Content contentContainerStyle={styles.content}>
        {data &&
          data.map((category, index) => {
            return (
              <LayoutCustom key={index} onPress={onClose}>
                <ButtonSelectCategory
                  onClose={onClose}
                  onSelect={onSelect}
                  lastItem={data.length - 1 === index}
                  props={category}
                  key={index}
                  isOpen={!colapse}
                />
              </LayoutCustom>
            );
          })}
      </Content>
    </Container>
  );
};

export default SelectCategory;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    paddingHorizontal: 32,
    paddingBottom: 60,
    paddingTop: 24,
  },
});
