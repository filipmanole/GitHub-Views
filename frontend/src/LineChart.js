import React from "react";
import _ from "lodash";
import moment from "moment";
import { DataContext } from "./Data";
import { Grid, Button } from "@material-ui/core";
import Chart from "chart.js";
import "./LineWithLine";
import "./LineChart.css";

import DateRangePicker from "@wojtekmaj/react-daterange-picker";
import DeleteIcon from "@material-ui/icons/Delete";
import ShareButton from "./ShareButton";
import ChoseReposModal from "./ChoseReposModal";

function daysBetwwed2Dates(date1, date2) {
  const timeDiff = date2.getTime() - date1.getTime();
  return Math.round(timeDiff / (1000 * 3600 * 24)) + 1;
}

function LineChart({ aggregateId, data, type }) {
  const chartRef = React.useRef();
  const {
    repos,
    updateAggregateChart,
    deleteAggregateChart
  } = React.useContext(DataContext);
  const [chart, setChart] = React.useState();
  const labels = data.timestamp;

  const minLimit = new Date(labels[0]);

  const maxLimit = new Date(labels[labels.length - 1]);
  const [time, setTime] = React.useState([minLimit, maxLimit]);

  React.useEffect(_ => {
    setChart(
      new Chart(chartRef.current, {
        /* The type of chart we want to create */
        type: "LineWithLine",

        /* The data for our dataset */
        data: {
          labels,
          datasets: data.data.map(d => ({
            label: d.label,
            fill: false,
            backgroundColor: d.color,
            borderColor: d.color,
            data: d.dataset
          }))
        },

        /* Configuration options go here */
        options: {
          animation: false,
          tooltips: {
            intersect: false,
            mode: "label",
            position: "nearPointer"
          },
          scales: {
            xAxes: [
              {
                ticks: {
                  autoSkip: true,
                  maxTicksLimit: 8
                }
              }
            ],
            yAxes: [
              {
                ticks: {
                  beginAtZero: true
                }
              }
            ]
          },
          elements: {
            line: {
              tension: 0
            }
          }
        }
      })
    );
  }, []);

  React.useEffect(() => {
    if (chart) {
      const [minTime, maxTime] = time;

      const lowerIndex = daysBetwwed2Dates(minLimit, minTime);
      const upperIndex = daysBetwwed2Dates(minLimit, maxTime);

      chart.data = {
        labels: labels.slice(lowerIndex, upperIndex),
        datasets: data.data.map(d => ({
          label: d.label,
          fill: false,
          backgroundColor: d.color,
          borderColor: d.color,
          data: d.dataset.slice(lowerIndex, upperIndex)
        }))
      };

      chart.update();
      setChart(chart);
    }
  }, [data, labels, time, chart, minLimit]);

  return (
    <Grid container className="chartWrapper">
      <Grid container justify="space-between">
        <h1>{data.chartname}</h1>
        {type === "aggregateCharts" ? (
          <div style={{ display: "flex" }}>
            <ChoseReposModal
              chartToEdit={aggregateId}
              allRepos={[...repos["userRepos"], ...repos["sharedRepos"]]}
              selectedRepos={data.data.map(r => r._id)}
              onChange={(id, state) => {
                updateAggregateChart(aggregateId, id, state);
              }}
              onClose={repo_list => {
                const dataJSON = {
                  chartId: aggregateId,
                  repoList: _.uniq(repo_list)
                };
                fetch("/api/aggCharts/update", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify(dataJSON)
                });
              }}
            />
            &nbsp;
            <div
              className="icon"
              onClick={() => {
                deleteAggregateChart(aggregateId);

                const dataJSON = {
                  chartId: aggregateId
                };

                fetch("/api/aggCharts/delete", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify(dataJSON)
                });
              }}
            >
              <DeleteIcon />
            </div>
          </div>
        ) : (
          <div>
            <ShareButton repoId={data._id} />
          </div>
        )}
      </Grid>

      <DateRangePicker
        minDate={minLimit}
        maxDate={maxLimit}
        onChange={interval => {
          if (interval) {
            setTime(interval);
          } else {
            setTime([minLimit, maxLimit]);
          }
        }}
        value={[...time]}
      />

      <div className="timewinbtnsWrapper">
        <Button
          className="timewinbtn"
          onClick={_ =>
            setTime([
              moment()
                .subtract(1, "months")
                .toDate(),
              moment().toDate()
            ])
          }
          disabled={moment()
            .subtract(1, "months")
            .isBefore(labels[0])}
        >
          Last Month
        </Button>

        <Button
          className="timewinbtn"
          onClick={_ =>
            setTime([
              moment()
                .subtract(6, "months")
                .toDate(),
              moment().toDate()
            ])
          }
          disabled={moment()
            .subtract(6, "months")
            .isBefore(labels[0])}
        >
          Last 6 Months
        </Button>
      </div>

      <canvas ref={chartRef} />
    </Grid>
  );
}

export default LineChart;
