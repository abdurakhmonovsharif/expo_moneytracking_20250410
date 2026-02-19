import dayjs from 'dayjs';

type DateLabelOptions = {
  today: string;
  yesterday: string;
  lastWeek: string;
};

type FormatDateOptions = {
  labels?: DateLabelOptions;
};

export const formatDate = (date: Date, options?: FormatDateOptions): string => {
  const today = dayjs().startOf('day');
  const lastWeek = today.subtract(1, 'week');
  const yesterday = today.subtract(1, 'day');
  const givenDate = dayjs(date).startOf('day');
  const labels = options?.labels ?? {
    today: 'Today',
    yesterday: 'Yesterday',
    lastWeek: 'Last week',
  };

  if (givenDate.isSame(today)) {
    return `${labels.today}, ${givenDate.format('DD MMM YYYY')}`;
  } else if (givenDate.isSame(yesterday)) {
    return `${labels.yesterday}, ${givenDate.format('DD MMM YYYY')}`;
  } else if (givenDate.isSame(lastWeek, 'week')) {
    return `${labels.lastWeek}, ${givenDate.format('DD MMM YYYY')}`;
  } else {
    return givenDate.format('DD MMM YYYY');
  }
};
